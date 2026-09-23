import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="flex-1 flex items-center justify-center p-6 bg-neutral-50">
      <SignUp />
    </main>
  );
}
