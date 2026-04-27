export enum Lifecycle {
	RunBeforeEachTest = "BeforeEach",
	RunBeforeAllTests = "BeforeAll",
	RunAfterEachTest = "AfterEach",
	RunAfterAllTests = "AfterAll",
}

export const enum MetadataKey {
	Method = "lunit:method:test",
	Class = "lunit:class",
}
