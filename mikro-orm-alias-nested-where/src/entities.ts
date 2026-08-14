import { Collection } from "@mikro-orm/core";
import { Entity, ManyToOne, OneToMany, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";

@Entity()
export class Author {
  @PrimaryKey({ type: "number" })
  id!: number;

  @Property({ type: "string" })
  name!: string;

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
