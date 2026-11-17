import { createFileRoute } from "@tanstack/react-router";
import { CreateConnectionPage } from "~/features/create-connection";

export const Route = createFileRoute("/connections/create")({ component: CreateConnectionPage });
