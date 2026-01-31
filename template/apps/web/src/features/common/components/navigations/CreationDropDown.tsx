"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useSidebar,
} from "@carlonicora/nextjs-jsonapi/components";
import { PlusCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export default function CreationDropDown() {
  const { state } = useSidebar();
  const t = useTranslations();

  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger>
          <Button render={<div />} nativeButton={false} variant="outline" className="bg-accent text-accent-foreground">
            <PlusCircleIcon />
            {state === "collapsed" ? <></> : <span>{t(`common.create`)}</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-96">
          <DropdownMenuLabel>{t(`common.create_new`)}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {/* Add your entity creation menu items here */}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
