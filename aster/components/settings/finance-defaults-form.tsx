"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getSettings, updateSettings, getErrorMessage } from "@/services/settings";

const financeDefaultsSchema = z.object({
  VISA_FEE_DEFAULT_DIRECT: z
    .string()
    .refine((v) => Number.isFinite(Number(v)) && Number(v) > 0, "Must be a positive number"),
  VISA_FEE_DEFAULT_AGENCY: z
    .string()
    .refine((v) => Number.isFinite(Number(v)) && Number(v) > 0, "Must be a positive number"),
});

type FinanceDefaultsValues = z.infer<typeof financeDefaultsSchema>;

export function FinanceDefaultsForm() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const form = useForm<FinanceDefaultsValues>({
    defaultValues: { VISA_FEE_DEFAULT_DIRECT: "", VISA_FEE_DEFAULT_AGENCY: "" },
  });

  useEffect(() => {
    let active = true;
    getSettings()
      .then((settings) => {
        if (!active) return;
        form.reset({
          VISA_FEE_DEFAULT_DIRECT: settings.VISA_FEE_DEFAULT_DIRECT ?? "",
          VISA_FEE_DEFAULT_AGENCY: settings.VISA_FEE_DEFAULT_AGENCY ?? "",
        });
      })
      .catch((error) => {
        toast.error("Could not load finance defaults", getErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disabled = loading || form.formState.isSubmitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Finance defaults</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              const parsed = financeDefaultsSchema.safeParse(values);
              if (!parsed.success) {
                for (const issue of parsed.error.issues) {
                  form.setError(issue.path[0] as keyof FinanceDefaultsValues, {
                    message: issue.message,
                  });
                }
                return;
              }
              try {
                const updated = await updateSettings(parsed.data);
                form.reset({
                  VISA_FEE_DEFAULT_DIRECT: updated.VISA_FEE_DEFAULT_DIRECT ?? "",
                  VISA_FEE_DEFAULT_AGENCY: updated.VISA_FEE_DEFAULT_AGENCY ?? "",
                });
                toast.success("Finance defaults updated");
              } catch (error) {
                toast.error("Could not update finance defaults", getErrorMessage(error));
              }
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="VISA_FEE_DEFAULT_DIRECT"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default visa fee — Direct cases (USD)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" step="1" disabled={disabled} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="VISA_FEE_DEFAULT_AGENCY"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default visa fee — Agency cases (USD)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" step="1" disabled={disabled} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={disabled}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save defaults
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
