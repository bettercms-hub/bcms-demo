import { linkOptions } from "@tanstack/react-router";

export type FormTab = "build" | "submissions" | "integrations" | "code";

export type FormAction = "edit" | "submissions" | "code";

const ACTION_TAB: Record<FormAction, FormTab> = {
  edit: "build",
  submissions: "submissions",
  code: "code",
};

export function formBuilderLink(args: {
  workspace: string;
  project: string;
  formId: string;
  tab?: FormTab;
}) {
  return linkOptions({
    to: "/w/$workspace/p/$project/forms/$formId",
    params: {
      workspace: args.workspace,
      project: args.project,
      formId: args.formId,
    },
    search: { tab: args.tab ?? "build" },
  });
}

export function formActionLink(args: {
  workspace: string;
  project: string;
  formId: string;
  action: FormAction;
}) {
  return formBuilderLink({
    workspace: args.workspace,
    project: args.project,
    formId: args.formId,
    tab: ACTION_TAB[args.action],
  });
}

export function formsIndexLink(args: { workspace: string; project: string }) {
  return linkOptions({
    to: "/w/$workspace/p/$project/forms",
    params: { workspace: args.workspace, project: args.project },
  });
}
