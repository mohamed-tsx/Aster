"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { searchPatients, getErrorMessage } from "@/services/cases";
import type { PatientSummary } from "@/types/patient";

type PatientSearchProps = {
  selectedPatient: PatientSummary | null;
  onSelect: (patient: PatientSummary | null) => void;
};

export function PatientSearch({ selectedPatient, onSelect }: PatientSearchProps) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const found = await searchPatients(query.trim());
      setResults(found);
      setSearched(true);
    } catch (error) {
      toast.error("Search failed", getErrorMessage(error));
    } finally {
      setSearching(false);
    }
  };

  if (selectedPatient) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-medium">
              {selectedPatient.firstName} {selectedPatient.lastName}
            </p>
            <p className="text-xs text-muted-foreground">
              Passport {selectedPatient.passportNumber} · Reusing existing patient record
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onSelect(null)}>
            <X className="mr-2 h-4 w-4" />
            Change
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-medium">Returning patient?</p>
        <div className="flex gap-2">
          <Input
            placeholder="Search by passport number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={handleSearch} disabled={searching}>
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
        </div>
        {searched && results.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No match — fill in the new patient&apos;s details below.
          </p>
        )}
        {results.length > 0 && (
          <div className="space-y-1 rounded-md border p-2">
            {results.map((patient) => (
              <button
                key={patient.id}
                type="button"
                onClick={() => onSelect(patient)}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span>
                  {patient.firstName} {patient.lastName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {patient.passportNumber}
                </span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
