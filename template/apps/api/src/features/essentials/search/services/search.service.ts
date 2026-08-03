import { Injectable } from "@nestjs/common";
import { SearchRepository, SearchResult } from "../repositories/search.repository";

@Injectable()
export class SearchService {
  constructor(private readonly searchRepository: SearchRepository) {}

  async search(params: { term: string; types?: string[] }): Promise<SearchResult[]> {
    return this.searchRepository.find(params);
  }
}
