declare module "@phosphor-icons/react-mine" {
  import React from "react";
  export interface IconProps extends React.SVGAttributes<SVGElement> {
    color?: string;
    size?: string | number;
    weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
    mirrored?: boolean;
  }
  export type Icon = React.ForwardRefExoticComponent<
    IconProps & React.RefAttributes<SVGSVGElement>
  >;

  export const Sparkle: Icon;
  export const ShieldCheck: Icon;
  export const UserCircle: Icon;
  export const Briefcase: Icon;
  export const SignOut: Icon;
  export const Kanban: Icon;
  export const UsersThree: Icon;
  export const GitFork: Icon;
  export const Buildings: Icon;
  export const AddressBook: Icon;
  export const CheckCircle: Icon;
  export const Circle: Icon;
  export const Clock: Icon;
  export const CalendarBlank: Icon;
  export const WarningCircle: Icon;
  export const Check: Icon;
  export const Plus: Icon;
  export const Trash: Icon;
  export const ArrowUp: Icon;
  export const ArrowDown: Icon;
  export const PencilSimple: Icon;
  export const UserPlus: Icon;
  export const ListBullets: Icon;
  export const X: Icon;
  export const UserSwitch: Icon;
}
