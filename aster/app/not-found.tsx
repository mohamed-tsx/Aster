"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6 py-16">
      <div className="animate-fade-in flex w-full max-w-md flex-col items-center text-center">
        <div className="bg-brand-blue mb-10 rounded-xl px-5 py-3">
          <Image
            src="/aster-logo.svg"
            alt="Aster Hospital Referral Center - East Africa"
            width={140}
            height={40}
          />
        </div>

        <div className="relative mb-6 flex items-center justify-center">
          <span className="text-8xl font-bold tracking-tight text-brand-blue">
            404
          </span>
          <div className="bg-brand-green-soft absolute -right-2 -top-2 flex h-10 w-10 items-center justify-center rounded-full">
            <SearchX className="text-brand-green h-5 w-5" />
          </div>
        </div>

        <h1 className="text-xl font-semibold text-foreground">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have been
          moved.
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button
            variant="outline"
            className="sm:w-auto"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
          <Button asChild className="sm:w-auto">
            <Link href="/dashboard">
              <Home className="h-4 w-4" />
              Back to dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
