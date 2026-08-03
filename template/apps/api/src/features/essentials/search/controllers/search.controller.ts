import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import { FastifyReply } from "fastify";
import { JwtAuthGuard } from "@carlonicora/nestjs-neo4jsonapi";
import { SearchService } from "../services/search.service";
import { searchMeta } from "../entities/search.meta";

@UseGuards(JwtAuthGuard)
@Controller()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get(searchMeta.endpoint)
  async search(@Res() reply: FastifyReply, @Query("term") term: string, @Query("types") types?: string) {
    if (!term || term.trim().length === 0) {
      return reply.send({ data: [] });
    }

    const typeArray = types
      ? types
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;
    const results = await this.searchService.search({ term, types: typeArray });

    reply.send({
      data: results.map((r) => ({
        type: r.type.toLowerCase() + "s",
        id: r.id,
        attributes: {
          name: r.name,
          entityType: r.type,
          score: r.score,
        },
      })),
    });
  }
}
