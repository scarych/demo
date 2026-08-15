import { Entity, ManyToOne, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";

@Entity()
export class Employee {
  @PrimaryKey({ type: "number" })
  id!: number;

  @Property({ type: "string" })
  name!: string;

  @ManyToOne({ entity: () => Employee, nullable: true })
  manager?: Employee;
}
