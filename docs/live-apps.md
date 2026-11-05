# EduNexa live apps

EduNexa now comes as two real apps with real accounts, plus the old demo.

| App | Who signs in | Web | Android |
|---|---|---|---|
| **EduNexa** | Head Teacher, Teachers, Students, Parents, Accountant, Librarian, Storekeeper, Transport Officer, Canteen Manager, Hostel/Boarding Manager, Support Staff, Gate Kiosk | https://nyamebabaku-lab.github.io/edunexa/ | [EduNexa.apk](https://github.com/nyamebabaku-lab/edunexa/releases/latest/download/EduNexa.apk) |
| **EduNexa Admin** | School Owner/Admin and the EduNexa Super Admin | https://nyamebabaku-lab.github.io/edunexa/admin/ | [EduNexa-Admin.apk](https://github.com/nyamebabaku-lab/edunexa/releases/latest/download/EduNexa-Admin.apk) |
| Demo | Anyone (one-click demo logins, sample school) | https://nyamebabaku-lab.github.io/edunexa/demo/ | — |

The live apps have no demo data. They offer only **Sign in** and **Create account**. Nobody can create a Super Admin account from them.

## How accounts work

1. **Super Admin (one-time).**
   - Open EduNexa Admin and tap **Set up the EduNexa Super Admin** (shown only until it is claimed).
   - Only the reserved email, `nyamebabaku@gmail.com`, can claim it.
2. **A school registers.**
   - In EduNexa Admin, the owner taps **Register a school** and enters the school name, logo, theme colour and their own details.
   - The school and its owner wait as *pending*.
3. **The Super Admin approves the school** on the **Schools** page. This also activates the owner. Each school gets a 6-character **school code**.
4. **Everyone else joins** in the EduNexa app:
   1. Tap **Create account** and enter the school code.
   2. Choose a role.
   3. Enter name, phone or email, and a password.
   - Parents and students also enter the student's **admission number**. It is matched automatically, and the Owner/Admin sees the matched student before approving.
5. **The Owner/Admin approves** them on the **Accounts** page.
   - Actions: approve, suspend, activate, deactivate, reset password, delete.
   - The Super Admin can do the same for any account in any school, and can suspend or delete schools.
   - On approval:
     - Teachers and staff are linked to the staff record with the same phone or email, or a new one is created.
     - A parent is linked to the child's parent record, or a new one is created.
6. A school's data is visible only to that school. The database enforces it, and each role sees only what it needs. For example:
   - parents see only their own children;
   - the Head Teacher can view fees but not change them;
   - private messages are visible only to the sender and the receiver.

Each school's **logo and theme colour** replace EduNexa's throughout:
- the menu;
- report cards, receipts, ID cards and payslips;
- the gate kiosk.

"Powered by EduNexa" stays small under the school name.

## Importing existing records from Excel

1. In EduNexa Admin, open **Import from Excel**.
2. Download the template. A copy is also in [`docs/EduNexa-Import-Template.xlsx`](EduNexa-Import-Template.xlsx).
3. Fill in any of these sheets:
   - Students, with parents on the same row
   - Staff (with "Teaches" pairs and class-teacher assignments)
   - Classes
   - Subjects
   - Fee Balances (opening arrears)
   - Scores (past results)
   - Library Books
   - Store Items
4. Upload the file and check the preview. It shows new and updated records, and problems listed by row.
5. Tap **Import**.

Notes:
- Importing works **offline too**. Records are saved on the device and uploaded when the connection returns.
- Importing the same file again **updates** records rather than duplicating them. Matching is by:

  | Record | Matched by |
  |---|---|
  | Students | admission number |
  | Staff | staff number, email or phone |
  | Classes | name |
  | Books | ISBN |
  | Store items | SKU |

- Brothers and sisters with the same parent phone number share one parent record.

## For developers

| Area | Where it lives |
|---|---|
| Builds | `VITE_APP=main\|admin\|demo` (`src/config.js`). `npm run build` builds all three into `dist/`, `dist/admin/` and `dist/demo/`, plus the Excel template. |
| Backend | Supabase project `jepkzvunetajsgscoelv`, shared with MyVoteHub. EduNexa uses its own `edunexa` schema. Migrations are in `supabase/migrations/`. |
| Permissions | `src/lib/access.js` is the role × collection matrix. Run `npm run access-sql` to regenerate `0002_access.sql` after changing it. |
| Sync | `src/data/sync.js`: loads what the account may read and keeps it updated in real time. Writes go through an offline outbox. |
| Android | Capacitor projects in `android/` (`com.edunexa.app`) and `android-admin/` (`com.edunexa.admin`). `.github/workflows/android.yml` builds signed APK and AAB files on every push to `main`. The signing key is backed up in `/home/BrandsME/projects/edunexa-signing`; keep it safe. |
