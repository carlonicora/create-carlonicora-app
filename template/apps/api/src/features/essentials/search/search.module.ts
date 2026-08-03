import { Module } from "@nestjs/common";
import { SearchController } from "./controllers/search.controller";
import { SearchRepository } from "./repositories/search.repository";
import { SearchService } from "./services/search.service";

@Module({
  controllers: [SearchController],
  providers: [SearchRepository, SearchService],
  exports: [SearchService],
})
export class SearchModule {}
