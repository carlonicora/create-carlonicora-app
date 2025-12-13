"use client";

import { JsonApiHydratedDataInterface } from "@carlonicora/nextjs-jsonapi/core";

type IndexContainerProps = {
  dehydratedContentList: JsonApiHydratedDataInterface[];
};

export default function IndexContainer({ dehydratedContentList }: IndexContainerProps) {
  return <div>index</div>;
}
