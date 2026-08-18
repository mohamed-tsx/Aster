import { GalleryVerticalEnd } from "lucide-react";

import { LoginForm } from "@/components/login-form";
import Image from "next/image";

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <Image
              src="/aster-logo.svg"
              alt="Aster Hospital Referral Center"
              width={100}
              height={100}
            />
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm />
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block items-end justify-start h-screen w-full">
        <img
          src="/login.png"
          alt="Aster Hospital Referral Center"
          className="h-screen w-full object-cover dark:brightness-[0.2] dark:grayscale items-end flex justify-start"
        />
      </div>
    </div>
  );
}
