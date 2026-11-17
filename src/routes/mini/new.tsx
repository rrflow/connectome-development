import { createFileRoute } from "@tanstack/react-router";
import { NewEmbedPage } from "~/features/embed-builder";

export const Route = createFileRoute("/mini/new")({ component: NewEmbedPage });
