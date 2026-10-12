"use client";

import type { FormHTMLAttributes } from "react";

/** GET form that also submits when a control changes (progressive enhancement: the Apply button still works). */
export function AutoSubmitForm(props: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form
      {...props}
      onChange={(event) => {
        const target = event.target;
        if ((target instanceof HTMLInputElement && target.type === "checkbox") || target instanceof HTMLSelectElement) {
          event.currentTarget.requestSubmit();
        }
      }}
    />
  );
}
