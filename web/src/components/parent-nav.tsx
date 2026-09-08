import { ImagePlaceholder } from '@/components/image-placeholder';
import { LogoutButton } from '@/app/parent/LogoutButton';

// En-tête partagé de l'espace parent (/parent/*).
// Affiché par parent/layout.tsx : logo placeholder à gauche, profil +
// déconnexion à droite. Reçoit les infos utilisateur du layout (qui a déjà
// validé le JWT via la query `me`).
export function ParentNav({
  email,
  firstName,
  lastName,
}: {
  email: string;
  firstName: string;
  lastName: string;
}) {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {/* TODO: replace with actual logo image */}
          <ImagePlaceholder className="size-8" />
          <span className="font-semibold tracking-tight">FamilyPay</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {firstName} {lastName} · {email}
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
