import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

export default function ThankYouPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Merci pour votre participation !</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Vos réponses ont été enregistrées de manière anonyme. Elles
            contribueront à améliorer votre environnement de travail.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
