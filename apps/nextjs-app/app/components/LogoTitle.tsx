import Image from "next/image";
import Logo from "@/app/assets/logo.png";

export default function LogoTitle({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src={Logo}
        alt="Logo"
        className="h-10 w-8 object-contain"
        priority
      />
      <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent leading-tight">
        CollabCode
      </h1>
    </div>
  );
}
