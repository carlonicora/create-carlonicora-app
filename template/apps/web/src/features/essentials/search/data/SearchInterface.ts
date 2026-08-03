import { ApiDataInterface } from "@carlonicora/nextjs-jsonapi/core";

export interface SearchInterface extends ApiDataInterface {
  get name(): string;
  get entityType(): string;
  get score(): number;
}
