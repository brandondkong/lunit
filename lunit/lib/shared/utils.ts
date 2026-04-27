import { BaseMetadata } from "./types";

export function addTagsToMetadata(metadata: BaseMetadata, ...tags: string[]): void {
	if (!metadata.tags) {
		metadata.tags = table.clone(tags);
	} else tags.forEach((tag) => metadata.tags?.push(tag));
}
