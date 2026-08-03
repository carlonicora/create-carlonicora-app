import { ModuleFactory } from "@carlonicora/nextjs-jsonapi/core";
import { Search } from "./data/Search";

export const SearchModule = (factory: ModuleFactory) =>
  factory({
    pageUrl: "/searches",
    name: "searches",
    model: Search,
    moduleId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  });
