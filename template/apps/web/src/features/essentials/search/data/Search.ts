import { AbstractApiData, JsonApiHydratedDataInterface } from "@carlonicora/nextjs-jsonapi/core";
import { SearchInterface } from "./SearchInterface";

export class Search extends AbstractApiData implements SearchInterface {
  private _name?: string;
  private _entityType?: string;
  private _score?: number;

  get name(): string {
    return this._name ?? "";
  }

  get entityType(): string {
    return this._entityType ?? "";
  }

  get score(): number {
    return this._score ?? 0;
  }

  rehydrate(data: JsonApiHydratedDataInterface): this {
    super.rehydrate(data);
    this._name = data.jsonApi.attributes.name;
    this._entityType = data.jsonApi.attributes.entityType;
    this._score = data.jsonApi.attributes.score;
    return this;
  }

  createJsonApi(): never {
    throw new Error("Search is read-only");
  }
}
