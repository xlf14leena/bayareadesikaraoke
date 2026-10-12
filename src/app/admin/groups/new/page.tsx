import Breadcrumbs from "@/app/admin/Breadcrumbs";
import { createGroup } from "@/app/admin/actions";
import GroupForm from "@/components/admin/GroupForm";
import { cardClass } from "@/components/ui";
import { requireSuperUser } from "@/lib/roles";

export default async function NewGroupPage() {
  await requireSuperUser("/admin/groups/new");
  return (
    <div>
      <Breadcrumbs items={[{ href: "/admin", label: "Admin" }, { label: "New group" }]} />
      <h1 className="mb-4 font-display text-3xl text-royal">New group</h1>
      <div className={cardClass}>
        <GroupForm action={createGroup} />
      </div>
    </div>
  );
}
