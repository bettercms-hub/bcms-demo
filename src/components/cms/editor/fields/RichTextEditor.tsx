import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote,
  Link as LinkIcon, Image as ImageIcon, Eraser,
} from "lucide-react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  compact?: boolean;
}

export function RichTextEditor({ value, onChange, placeholder, compact }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Typography,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Placeholder.configure({ placeholder: placeholder ?? "Write something…" }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: `bcms-prose min-h-[${compact ? "80" : "160"}px] w-full rounded-b-[6px] border-x border-b border-border bg-white px-3 py-2 text-[13px] text-foreground focus:border-primary focus:outline-none`,
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Keep external value updates in sync (e.g. node switch).
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== (value || "")) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  const Btn = ({
    on, active, title, children,
  }: { on: () => void; active?: boolean; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      title={title}
      onClick={on}
      className={`grid h-7 w-7 place-items-center rounded-[4px] transition-colors ${
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };
  const addImage = () => {
    const url = window.prompt("Image URL", "https://");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  return (
    <div className="rounded-[6px] border border-border bg-white">
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-[6px] border-b border-border bg-surface/50 px-1.5 py-1">
        <Btn title="Bold" on={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}><Bold className="h-3.5 w-3.5" /></Btn>
        <Btn title="Italic" on={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}><Italic className="h-3.5 w-3.5" /></Btn>
        <Btn title="Underline" on={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")}><UnderlineIcon className="h-3.5 w-3.5" /></Btn>
        <Btn title="Strike" on={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")}><Strikethrough className="h-3.5 w-3.5" /></Btn>
        <Btn title="Code" on={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")}><Code className="h-3.5 w-3.5" /></Btn>
        <span className="mx-1 h-4 w-px bg-border" />
        <Btn title="H1" on={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })}><Heading1 className="h-3.5 w-3.5" /></Btn>
        <Btn title="H2" on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}><Heading2 className="h-3.5 w-3.5" /></Btn>
        <Btn title="H3" on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}><Heading3 className="h-3.5 w-3.5" /></Btn>
        <span className="mx-1 h-4 w-px bg-border" />
        <Btn title="Bullet list" on={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}><List className="h-3.5 w-3.5" /></Btn>
        <Btn title="Numbered list" on={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}><ListOrdered className="h-3.5 w-3.5" /></Btn>
        <Btn title="Quote" on={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}><Quote className="h-3.5 w-3.5" /></Btn>
        <span className="mx-1 h-4 w-px bg-border" />
        <Btn title="Link" on={setLink} active={editor.isActive("link")}><LinkIcon className="h-3.5 w-3.5" /></Btn>
        <Btn title="Image" on={addImage}><ImageIcon className="h-3.5 w-3.5" /></Btn>
        <span className="ml-auto" />
        <Btn title="Clear formatting" on={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}><Eraser className="h-3.5 w-3.5" /></Btn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
