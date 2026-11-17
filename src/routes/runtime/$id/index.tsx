import { createFileRoute } from "@tanstack/react-router";
import { ProjectHome } from "~/features/runtime/home/project-home";

/** A project's own address shows its Home in place; its address does not change. */
export const Route = createFileRoute("/runtime/$id/")({ component: ProjectHome });
