import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Neo4jService } from "@carlonicora/nestjs-neo4jsonapi";
import { ClsService } from "nestjs-cls";

const EXPECTED_SEARCH_LABELS: string[] = [];

const EXPECTED_PROPERTIES = ["name", "number", "address", "first_name", "last_name"];

const INDEX_NAME = "search_index";

export interface SearchResult {
  id: string;
  name: string;
  type: string;
  score: number;
}

@Injectable()
export class SearchRepository implements OnModuleInit {
  private readonly logger = new Logger(SearchRepository.name);

  constructor(
    private readonly neo4j: Neo4jService,
    private readonly clsService: ClsService,
  ) {}

  async onModuleInit() {
    await this.manageSearchIndex();
  }

  private async manageSearchIndex(): Promise<void> {
    if (EXPECTED_SEARCH_LABELS.length === 0) {
      this.logger.log(`Search index management skipped: no labels configured`);
      return;
    }

    const result = await this.neo4j.read(
      `
      SHOW INDEXES
      YIELD name, type, entityType, labelsOrTypes, properties
      WHERE name = $indexName AND type = 'FULLTEXT' AND entityType = 'NODE'
      RETURN labelsOrTypes AS labels, properties
      `,
      { indexName: INDEX_NAME },
    );

    const existingIndex = result.records[0];
    const existingLabels = existingIndex?.get("labels") ?? [];
    const existingProperties = existingIndex?.get("properties") ?? [];

    const needsUpdate =
      !existingIndex ||
      !this.arraysEqual(existingLabels, EXPECTED_SEARCH_LABELS) ||
      !this.arraysEqual(existingProperties, EXPECTED_PROPERTIES);

    if (needsUpdate) {
      this.logger.log(`Search index ${INDEX_NAME} needs ${existingIndex ? "update" : "creation"}`);

      if (existingIndex) {
        this.logger.log(
          `Current: Labels=[${existingLabels.join(", ")}], Properties=[${existingProperties.join(", ")}]`,
        );
        this.logger.log(
          `Expected: Labels=[${EXPECTED_SEARCH_LABELS.join(", ")}], Properties=[${EXPECTED_PROPERTIES.join(", ")}]`,
        );
      }

      await this.recreateSearchIndex();
    } else {
      this.logger.log(`Search index ${INDEX_NAME} is already up to date`);
    }
  }

  private async recreateSearchIndex(): Promise<void> {
    const labelClause = EXPECTED_SEARCH_LABELS.map((l) => `\`${l}\``).join(" | ");
    const propClause = EXPECTED_PROPERTIES.map((p) => `n.\`${p}\``).join(", ");

    const queries = [
      {
        query: `DROP INDEX \`${INDEX_NAME}\` IF EXISTS`,
        params: {},
      },
      {
        query: `CREATE FULLTEXT INDEX \`${INDEX_NAME}\` FOR (n:${labelClause}) ON EACH [${propClause}]`,
        params: {},
      },
    ];

    try {
      await this.neo4j.executeInTransaction(queries);
      this.logger.log(`Successfully recreated search index ${INDEX_NAME}`);
    } catch (error: any) {
      this.logger.error(`Failed to recreate search index ${INDEX_NAME}: ${error.message}`);
      throw error;
    }
  }

  private arraysEqual(a: any[], b: any[]): boolean {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, index) => val === sortedB[index]);
  }

  async find(params: { term: string; types?: string[] }): Promise<SearchResult[]> {
    const companyId = this.clsService.get("companyId");
    const allowedTypes = params.types?.filter((t) => EXPECTED_SEARCH_LABELS.includes(t));
    const hasTypeFilter = allowedTypes && allowedTypes.length > 0;

    const escapedTerm = params.term.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, "\\$&");
    const searchTerm = `*${escapedTerm.toLowerCase()}*`;

    let query = `
      MATCH (company:Company {id: $companyId})
      CALL db.index.fulltext.queryNodes("${INDEX_NAME}", $term)
      YIELD node, score
      WHERE (node)-[:BELONGS_TO]->(company)
      WITH node, score, head(labels(node)) AS label
    `;

    if (hasTypeFilter) {
      query += `WHERE label IN $types\n`;
    }

    query += `
      RETURN node.id AS id,
             COALESCE(node.name, node.first_name + ' ' + node.last_name, node.number, node.address, '') AS name,
             label AS type,
             score
      ORDER BY score DESC
      LIMIT 25
    `;

    const result = await this.neo4j.read(query, {
      companyId,
      term: searchTerm,
      ...(hasTypeFilter ? { types: allowedTypes } : {}),
    });

    return result.records.map((record: any) => ({
      id: record.get("id"),
      name: record.get("name"),
      type: record.get("type"),
      score: record.get("score"),
    }));
  }
}
