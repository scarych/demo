import { Collection, t } from "@mikro-orm/core";
import { Entity, ManyToOne, OneToMany, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";

@Entity()
export class Author {
  @PrimaryKey({ type: "number" })
  id!: number;

  @Property({ type: "string" })
  name!: string;

  @Property({ type: t.boolean })
  active!: boolean;

  // the JSON column lives on the joined entity only — `book` has no `meta` column
  @Property({ type: "json" })
  meta!: { tag: string }[];

  @OneToMany({ entity: () => Book, mappedBy: (book: Book) => book.author })
  books = new Collection<Book>(this);
}

@Entity()
export class Book {
  @PrimaryKey({ type: "number" })
  id!: number;

  @Property({ type: "string" })
  title!: string;

  @ManyToOne({ entity: () => Author })
  author!: Author;
}
