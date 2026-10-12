"use client";

import { useActionState } from "react";
import { Alert, Card } from "@/components/ui/display";
import { FormAlert } from "@/components/ui/form-alert";
import { Field } from "@/components/ui/form-controls";
import { SubmitButton } from "@/components/ui/submit-button";
import { importProductsAction } from "./actions";

export function ImportForm() {
  const [state, formAction] = useActionState(importProductsAction, null);
  const report = state?.ok ? state.data : undefined;
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4" encType="multipart/form-data">
        <FormAlert state={state && !state.ok ? state : null} />
        <Field id="csv-file" label="CSV file" hint="UTF-8, up to about 2,000 variant rows." error={errors.file} required>
          {(aria) => <input {...aria} type="file" name="file" accept=".csv,text/csv" className="block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface-muted file:px-3 file:py-2 file:text-sm file:font-medium" />}
        </Field>
        <div className="flex flex-wrap gap-2">
          <SubmitButton name="mode" value="validate" variant="outline" pendingLabel="Checking…">Check file</SubmitButton>
          <SubmitButton name="mode" value="apply" pendingLabel="Importing…">Import</SubmitButton>
        </div>
        <p className="text-xs text-muted-foreground">Every row is validated first. If any row has an error, nothing is imported.</p>
      </form>

      {report ? (
        <Card className="p-5" role="region" aria-label="Import report">
          {report.issues.length ? (
            <Alert tone="danger" title={`${report.issues.length} problem${report.issues.length === 1 ? "" : "s"} found${report.applied ? "" : " · nothing was imported"}`}>
              <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto">
                {report.issues.map((i, n) => (
                  <li key={n}>
                    {i.line ? <span className="font-mono text-xs">Line {i.line}: </span> : null}
                    {i.message}
                  </li>
                ))}
              </ul>
            </Alert>
          ) : report.applied ? (
            <Alert tone="success" title="Import complete">
              {report.creates} product(s) created and {report.updates} updated ({report.variants} variants).
            </Alert>
          ) : (
            <Alert tone="info" title="The file is valid">
              Ready to create {report.creates} product(s) and update {report.updates} ({report.variants} variants). Choose “Import” to apply.
            </Alert>
          )}
        </Card>
      ) : null}
    </div>
  );
}
