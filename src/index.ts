import express from 'express';
import { configureExpressRoutes } from './configureExpressRoutes';
import { configureWebsockets } from './configureWebsockets';

if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

export const app = express();
export const port = process.env.PORT || 3000;

configureExpressRoutes(app)

const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
})

configureWebsockets(server)

