export type SaveContent = Blob | string | Response | null;
export type SaveContentProvider = () => SaveContent | Promise<SaveContent>;

export async function writeSelectedFile(
	stream: FileSystemWritableFileStream,
	content: SaveContent | SaveContentProvider,
): Promise<void> {
	try {
		const result = typeof content === "function" ? await content() : content;
		if (!result) throw new Error("File is empty");
		if (result instanceof Response) {
			if (!result.body) throw new Error("File response has no body");
			await result.body.pipeTo(stream, { preventClose: true, preventAbort: true });
		} else {
			await stream.write(result);
		}
		await stream.close();
	} catch (error) {
		try {
			await stream.abort(error);
		} catch (abortError) {
			throw new AggregateError([error, abortError], "File write and abort both failed");
		}
		throw error;
	}
}
