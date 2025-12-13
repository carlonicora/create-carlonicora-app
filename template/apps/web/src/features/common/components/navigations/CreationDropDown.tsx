"use client";

import { useCurrentUserContext } from "@carlonicora/nextjs-jsonapi/contexts";
import { UserInterface } from "@carlonicora/nextjs-jsonapi/features";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useSidebar,
} from "@carlonicora/nextjs-jsonapi/shadcnui";
import { PlusCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export default function CreationDropDown() {
  const { state } = useSidebar();
  const t = useTranslations();
  const { hasPermissionToModule } = useCurrentUserContext<UserInterface>();

  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  // const [newArticleOpen, setNewArticleOpen] = useState<boolean>(false);
  // const [newHyperlinkOpen, setNewHyperlinkOpen] = useState<boolean>(false);
  // const [newDocumentOpen, setNewDocumentOpen] = useState<boolean>(false);
  // const [newGlossaryOpen, setNewGlossaryOpen] = useState<boolean>(false);
  // const [newDiscussionOpen, setNewDiscussionOpen] = useState<boolean>(false);

  // const handleArticleClick = () => {
  //   setMenuOpen(false);
  //   requestAnimationFrame(() => {
  //     setNewArticleOpen(true);
  //   });
  // };

  // const handleHyperlinkClick = () => {
  //   setMenuOpen(false);
  //   requestAnimationFrame(() => {
  //     setNewHyperlinkOpen(true);
  //   });
  // };

  // const handleDocumentClick = () => {
  //   setMenuOpen(false);
  //   requestAnimationFrame(() => {
  //     setNewDocumentOpen(true);
  //   });
  // };

  // const handleGlossaryClick = () => {
  //   setMenuOpen(false);
  //   requestAnimationFrame(() => {
  //     setNewGlossaryOpen(true);
  //   });
  // };

  // const handleDiscussionClick = () => {
  //   setMenuOpen(false);
  //   requestAnimationFrame(() => {
  //     setNewDiscussionOpen(true);
  //   });
  // };

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild suppressHydrationWarning>
          <Button variant="outline" className="bg-accent text-accent-foreground">
            <PlusCircleIcon />
            {state === "collapsed" ? <></> : <span>{t(`generic.create`)}</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-96">
          <DropdownMenuLabel>{t(`generic.create_new`)}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {/* <DropdownMenuItem onClick={handleArticleClick} className="flex items-center gap-2 font-normal">
            {getIconByModule({ module: Modules.Article })}
            {t(`types.articles`, { count: 1 })}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleHyperlinkClick} className="flex items-center gap-2 font-normal">
            {getIconByModule({ module: Modules.Hyperlink })}
            {t(`types.hyperlinks`, { count: 1 })}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDocumentClick} className="flex items-center gap-2 font-normal">
            {getIconByModule({ module: Modules.Document })}
            {t(`types.documents`, { count: 1 })}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleGlossaryClick} className="flex items-center gap-2 font-normal">
            {getIconByModule({ module: Modules.Glossary })}
            {t(`types.glossaries`, { count: 1 })}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDiscussionClick} className="flex items-center gap-2 font-normal">
            {getIconByModule({ module: Modules.Discussion })}
            {t(`types.discussions`, { count: 1 })}
          </DropdownMenuItem> */}
        </DropdownMenuContent>
      </DropdownMenu>
      {/* {hasPermissionToModule({ module: Modules.Article, action: Action.Create }) && (
        <ArticleEditor dialogOpen={newArticleOpen} onDialogOpenChange={setNewArticleOpen} />
      )}
      {hasPermissionToModule({ module: Modules.Hyperlink, action: Action.Create }) && (
        <HyperlinkEditor dialogOpen={newHyperlinkOpen} onDialogOpenChange={setNewHyperlinkOpen} />
      )}
      {hasPermissionToModule({ module: Modules.Document, action: Action.Create }) && (
        <DocumentEditor dialogOpen={newDocumentOpen} onDialogOpenChange={setNewDocumentOpen} />
      )}
      {hasPermissionToModule({ module: Modules.Glossary, action: Action.Create }) && (
        <GlossaryEditor dialogOpen={newGlossaryOpen} onDialogOpenChange={setNewGlossaryOpen} />
      )}
      {hasPermissionToModule({ module: Modules.Discussion, action: Action.Create }) && (
        <DiscussionEditor dialogOpen={newDiscussionOpen} onDialogOpenChange={setNewDiscussionOpen} />
      )} */}
    </>
  );
}
