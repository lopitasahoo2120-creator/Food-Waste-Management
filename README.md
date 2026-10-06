# FoodShare - Food Waste Management

Donors (restaurants, hostels, event caterers) post surplus food. Receivers (NGOs, shelters) claim it before it expires.

## Tech stack
- Frontend: HTML, CSS, vanilla JavaScript (`public/` folder)
- Backend: Node.js + Express (REST API)
- Database: SQLite (file `food.db`, auto-created from `schema.sql`)

## Run
1. Install Node.js 18+ (LTS)
2. `npm install`
3. `npm start`
4. Open http://localhost:3000

## How to use
1. Register one **Donor** and one **Receiver** (note the User IDs). Use a normal window for one and a private/incognito window for the other.
2. Donor: post food with a future expiry time.
3. Receiver: claim the food, then mark it collected.
4. Dashboard numbers at the top update automatically.

## API
| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/users | Register donor/receiver |
| GET | /api/users/:id | Login by User ID |
| GET | /api/food?status= | List food items |
| POST | /api/food | Donor posts food |
| PATCH | /api/food/:id/claim | Receiver claims |
| PATCH | /api/food/:id/collect | Mark collected |
| DELETE | /api/food/:id?donor_id= | Delete own available item |
| GET | /api/stats | Dashboard numbers |

## Database
users(id, name, role, phone) 1---* food_items(id, donor_id, title, quantity, location, expiry_time, status, claimed_by)
