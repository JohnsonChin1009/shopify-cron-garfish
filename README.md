Some things that I noticed and how I solved it:

1. One thing I realized is that after fetching all the orders, the cron would just reset back to the first item and check with my first implementation, but that is not efficient and time-consuming.

so I cached the timestamp for the first order (because when you call `Retrieve a list of orders` it returns the latest one), +1 second to it, and use it to compare in phase 2.

phase 1 is basically to get all existing ones first, then phase 2 is continuously monitoring to get any orders that are newer than the cache timestamp

what i think could improve: maybe implement webhooks to detect whenever a new order has been made?

2. there's a small issue when calling the open endpoint, because the order names are typically: `#XXXX` where X are numbers. When passing # into the url, it struggles to decode the URI hence when trying to test the endpoint you'll have to do something like:

```bash
http://localhost:3000/getOrderByName/%231105
```

`%23` refers to # but decoded

3. took a bit of time because trying to learn the structure and also how chaining different stuff works

### To get started

1. Clone the repository

2. Install packages

```bash
pnpm install
```

3. Create .env file from .env-sample and populate variables

```bash
mv .env-sample .env
```

4. Run db generation and migrations

```bash
pnpm db:generate
pnpm db:migrate
```

5. Run server

```bash
pnpm dev
```

6. Checkout endpoints after postgres db has been populated with orders

```
http://localhost:3000/getOrderByName/%231105
```
