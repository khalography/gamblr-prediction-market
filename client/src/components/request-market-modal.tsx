import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface RequestMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  "Sports",
  "Crypto",
  "Politics",
  "Pop Culture",
  "Science & Tech",
  "Other"
];

export function RequestMarketModal({ isOpen, onClose }: RequestMarketModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !category) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/markets/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          category,
          description: description || null
        })
      });

      if (!res.ok) {
        throw new Error("Failed to submit request");
      }

      toast({
        title: "Request Submitted!",
        description: "Your market request has been successfully recorded. The admin will review it soon."
      });

      setTitle("");
      setCategory("");
      setDescription("");
      onClose();
    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit request",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Request a New Market</DialogTitle>
          <DialogDescription>
            Tell us what kind of prediction market you would like to see listed on Gamblr.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="req-title" className="font-semibold text-sm">
              Market Title / Question <span className="text-red-500">*</span>
            </Label>
            <Input
              id="req-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Will Ethereum break $8,000 in 2026?"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-sm">
              Category <span className="text-red-500">*</span>
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category..." />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="req-desc" className="font-semibold text-sm">Description (Optional)</Label>
            <Textarea
              id="req-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe resolution details, oracle sources, or context."
              rows={3}
            />
          </div>

          <DialogFooter className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !title || !category}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
