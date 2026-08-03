import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class SearchQueryDTO {
  @IsNotEmpty()
  @IsString()
  term: string;

  @IsOptional()
  @IsString()
  types?: string;
}
