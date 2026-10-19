import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useContextConnection } from "~/providers/Context";
import { showErrorNotification } from "~/shared/util/helpers";
import { SidekickChat, SidekickChatMessage } from "~/types";
import { RecordId, rrflowql } from "../rrflow/client/values";

export function useSidekickChatsQuery(search?: string) {
	const [rrflow, isAvailable] = useContextConnection();

	return useQuery({
		queryKey: ["sidekick", "chats", { search }],
		enabled: isAvailable,
		refetchInterval: 30_000,
		queryFn: async () => {
			try {
				const [conversations] = await rrflow
					.query(rrflowql`
					SELECT *
					FROM sidekick_chat
					WHERE !${search} || title = <regex>${search} || <-sent_in<-sidekick_message.content ?= <regex>${search}
					ORDER BY last_activity DESC
				`)
					.collect<[SidekickChat[]]>();

				return conversations;
			} catch (error) {
				showErrorNotification({
					title: "Failed to fetch chat history",
					content: error,
				});

				console.error(error);
				return [];
			}
		},
	});
}

export function useSidekickMessagesMutation() {
	const [rrflow] = useContextConnection();

	return useMutation({
		mutationFn: async (chatId: RecordId) => {
			try {
				const [messages] = await rrflow
					.query(rrflowql`
					SELECT * FROM ${chatId}<-sent_in<-sidekick_message ORDER BY id ASC;
				`)
					.collect<[SidekickChatMessage[]]>();

				return messages;
			} catch (error) {
				showErrorNotification({
					title: "Failed to fetch chat messages",
					content: error,
				});

				console.error(error);
				return [];
			}
		},
	});
}

export function useSidekickRenameMutation() {
	const [rrflow] = useContextConnection();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ chatId, newName }: { chatId: RecordId; newName: string }) => {
			await rrflow.query(rrflowql`UPDATE ${chatId} SET title = ${newName}`);
		},
		onMutate: async ({ chatId, newName }) => {
			await queryClient.cancelQueries({ queryKey: ["sidekick", "chats"] });

			queryClient.setQueriesData<SidekickChat[]>(
				{ queryKey: ["sidekick", "chats"] },
				(old) => {
					return old?.map((chat) =>
						chat.id.equals(chatId) ? { ...chat, title: newName } : chat,
					);
				},
			);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["sidekick", "chats"] });
		},
	});
}

export function useSidekickDeleteMutation() {
	const [rrflow] = useContextConnection();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (chatId: RecordId) => {
			try {
				await rrflow.query(rrflowql`
					DELETE ${chatId}<-sent_in<-sidekick_message, ${chatId}
				`);
			} catch (error) {
				showErrorNotification({
					title: "Failed to delete chat",
					content: error,
				});

				console.error(error);
			}
		},
		onMutate: async (chatId) => {
			await queryClient.cancelQueries({ queryKey: ["sidekick", "chats"] });

			queryClient.setQueriesData<SidekickChat[]>({ queryKey: ["sidekick", "chats"] }, (old) =>
				old?.filter((chat) => !chat.id.equals(chatId)),
			);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["sidekick", "chats"] });
		},
	});
}
