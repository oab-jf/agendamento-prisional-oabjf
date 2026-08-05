import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/gestao")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: () => null,
});

