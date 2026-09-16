"use client";
// SPDX-License-Identifier: Apache-2.0
//
// Wallet connection.
//
// 1AM is the default wallet provider: connecting uses whichever wallet
// pickWallet() selects (lib/midnight/browser/connector.ts), which prefers 1AM,
// then Lace, then any other injected Midnight wallet. The button names the
// wallet that will actually be used.
//
// There is no demo identity. Connecting also attaches to the deployed contract,
// so a failure here means the app genuinely cannot do anything yet — it must be
// reported, never papered over with a stand-in.

import { Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { preferredWalletName } from "@/lib/midnight/wallet";
import { useVeriHealth } from "./verihealth-provider";

const ONE_AM_URL = "https://1am.xyz";

export function WalletConnect() {
  const { wallet, walletAvailable, connectWallet, status } = useVeriHealth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preferred, setPreferred] = useState<string | null>(null);

  // Extensions inject into the page, so read this after mount, not during render.
  useEffect(() => {
    setPreferred(preferredWalletName());
  }, [walletAvailable]);

  async function onConnect() {
    setBusy(true);
    setMessage(null);
    try {
      await connectWallet();
    } catch (e) {
      setMessage(
        e instanceof Error && e.message.length < 200
          ? e.message
          : `${preferred ?? "Your wallet"} did not complete the connection. Unlock it and try again.`,
      );
    } finally {
      setBusy(false);
    }
  }

  if (wallet) {
    return (
      <div className="flex items-center gap-2">
        <Badge>{`${wallet.walletName ?? "Wallet"} connected`}</Badge>
        <code className="text-xs text-muted-foreground">
          {wallet.address.slice(0, 14)}…{wallet.address.slice(-4)}
        </code>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        onClick={onConnect}
        disabled={busy || !walletAvailable || status === "unconfigured"}
      >
        <Wallet className="mr-2 h-4 w-4" />
        {busy || status === "connecting" ? "Connecting…" : `Connect ${preferred ?? "1AM"}`}
      </Button>
      {!walletAvailable && (
        <p className="text-xs text-muted-foreground">
          1AM wallet not detected in this browser.{" "}
          <a href={ONE_AM_URL} target="_blank" rel="noreferrer" className="underline">
            Get 1AM
          </a>
        </p>
      )}
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
