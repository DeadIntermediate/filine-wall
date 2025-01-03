import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Github, Lock, ArrowRight, Check } from "lucide-react";

const repoSchema = z.object({
  repoName: z.string()
    .min(1, "Repository name is required")
    .regex(/^[a-zA-Z0-9-_]+$/, "Only letters, numbers, hyphens, and underscores allowed"),
  description: z.string().optional(),
  token: z.string().min(1, "GitHub token is required")
});

type RepoFormData = z.infer<typeof repoSchema>;

export function GitHubWizard() {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  
  const form = useForm<RepoFormData>({
    resolver: zodResolver(repoSchema),
    defaultValues: {
      repoName: "",
      description: "",
      token: ""
    }
  });

  const createRepo = useMutation({
    mutationFn: async (data: RepoFormData) => {
      const response = await fetch("/api/github/create-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Repository created successfully",
        description: "Your private repository has been set up.",
      });
      setStep(3); // Move to success step
    },
    onError: (error) => {
      toast({
        title: "Failed to create repository",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RepoFormData) => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      createRepo.mutate(data);
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Github className="h-5 w-5" />
          GitHub Repository Setup
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="absolute top-0 left-0 w-full">
            <div className="flex justify-between">
              {[1, 2, 3].map((number) => (
                <div
                  key={number}
                  className={`rounded-full h-8 w-8 flex items-center justify-center ${
                    step >= number
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > number ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span>{number}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="mt-12"
          >
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {step === 1 && (
                  <>
                    <FormField
                      control={form.control}
                      name="repoName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Repository Name</FormLabel>
                          <FormControl>
                            <Input placeholder="my-awesome-project" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="A brief description of your project"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {step === 2 && (
                  <FormField
                    control={form.control}
                    name="token"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GitHub Personal Access Token</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="password"
                              className="pl-9"
                              placeholder="ghp_..."
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <p className="text-sm text-muted-foreground mt-1">
                          Create a token with 'repo' scope at{" "}
                          <a
                            href="https://github.com/settings/tokens/new"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            GitHub Settings
                          </a>
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {step === 3 ? (
                  <div className="text-center space-y-4">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                      <Check className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold">Repository Created!</h3>
                    <p className="text-muted-foreground">
                      Your private repository has been successfully created and configured.
                    </p>
                  </div>
                ) : (
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={createRepo.isPending}
                  >
                    {createRepo.isPending ? (
                      "Creating..."
                    ) : step === 1 ? (
                      <span className="flex items-center gap-2">
                        Next Step <ArrowRight className="h-4 w-4" />
                      </span>
                    ) : (
                      "Create Repository"
                    )}
                  </Button>
                )}
              </form>
            </Form>
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
