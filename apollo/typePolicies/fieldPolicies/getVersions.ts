import { FieldFunctionOptions, FieldPolicy } from "@apollo/client";
import { File, GetVersionsQueryVariables, QueryGetVersionsArgs } from "../../../types/graphql/types";

export const getVersionsFieldPolicy: FieldPolicy<File[] | null, File[] | null, File[] | null, FieldFunctionOptions<Partial<QueryGetVersionsArgs>, Partial<GetVersionsQueryVariables>>> = {
  merge(
    existing,
    incoming
) {
    // always overwrite existing data with incoming one
    return incoming;
  }
}
