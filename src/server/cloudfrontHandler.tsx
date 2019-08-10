import React from 'react';
import Html from "./Html";
import { StaticRouter } from "react-router-dom";
import App from "../App";

export default async function ({ Records: [ { cf: event } ] }: CloudfrontEvent) {
    const request = event.request;
    if (request.uri !== '/render') {
        return request;
    } 
    return {
        status: 200,
        body: Html(
            <StaticRouter context={{}} location={request.uri}>
                <App />
            </StaticRouter>
        )
    }
}