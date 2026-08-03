import { AbstractService, EndpointCreator, HttpMethod, Modules } from "@carlonicora/nextjs-jsonapi/core";
import { SearchInterface } from "./SearchInterface";

export class SearchService extends AbstractService {
  static async search(params: { term: string; types?: string[] }): Promise<SearchInterface[]> {
    const endpoint = new EndpointCreator({
      endpoint: Modules.Search,
    });

    endpoint.addAdditionalParam("term", params.term);
    if (params.types && params.types.length > 0) {
      endpoint.addAdditionalParam("types", params.types.join(","));
    }

    return this.callApi({
      type: Modules.Search,
      method: HttpMethod.GET,
      endpoint: endpoint.generate(),
    });
  }
}
