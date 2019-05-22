var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import 'reflect-metadata';
import axios from 'axios';
import { buildURL, concatURL, parseQuery } from '@vssue/utils';
import Bluebird from 'bluebird';
import { normalizeUser, normalizeIssue, normalizeComment, normalizeReactions, mapReactionName, logMethod, noticeError, } from './utils';
/**
 * @see https://gitee.com/api/v5/oauth_doc
 */
export default class VssueGiteeAPI {
    constructor({ baseURL = "https://gitee.com" /* BASE_URL */, owner, repo, labels, clientId, clientSecret, state, proxy, }) {
        this.scope = 'user_info issues notes';
        if (typeof clientSecret === 'undefined') {
            throw new Error(`clientSecret is required for ${"Gitee" /* SITE_NAME */}`);
        }
        this.baseURL = baseURL;
        this.owner = owner;
        this.repo = repo;
        this.labels = labels;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.state = state;
        this.proxy = proxy;
        this._pageInfo = {
            page: 1,
            startCursor: null,
            endCursor: null,
            sort: null,
            perPage: null,
        };
        this.$http = axios.create({
            baseURL: concatURL(baseURL, 'api/v5'),
            headers: {
                'Accept': 'application/json',
            },
        });
        this.$http.interceptors.response.use(response => {
            if (response.data.error) {
                return Promise.reject(response.data.error_description);
            }
            if (response.data.errors) {
                return Promise.reject(response.data.errors[0].message);
            }
            return response;
        });
    }
    /**
     * The platform api info
     */
    get platform() {
        return {
            name: "Gitee" /* SITE_NAME */,
            link: this.baseURL,
            version: 'v5',
            meta: {
                reactable: false,
                sortable: true,
            },
        };
    }
    /**
     * Redirect to the authorization page of platform.
     *
     * @see https://developer.github.com/apps/building-oauth-apps/authorizing-oauth-apps/#1-request-a-users-github-identity
     */
    redirectAuth() {
        window.location.href = buildURL(concatURL(this.baseURL, 'oauth/authorize'), {
            client_id: this.clientId,
            redirect_uri: window.location.href,
            scope: this.scope,
            state: this.state,
            response_type: 'code',
        });
    }
    _chooseAuth(query) {
        if (Array.isArray(query.state) || Array.isArray(query.code)) {
            for (let i in query.state) {
                if (query.state[i] === this.state && query.code[i]) {
                    return {
                        code: query.code[i],
                        state: query.state[i],
                    };
                }
            }
            return null;
        }
        return {
            code: query.code,
            state: query.state,
        };
    }
    _handleRequest(options, vssueData = {}) {
        const { accessToken } = vssueData;
        options.params = options.params || {};
        options.data = this._handleRequestPost(options.data, {
            options, vssueData,
        });
        options.headers = options.headers || {};
        if (accessToken) {
            options.headers['Authorization'] = `token ${accessToken}`;
            if (!options.method || options.method.toLowerCase() != 'post') {
                options.params.access_token = accessToken;
            }
        }
        return options;
    }
    _handleRequestPost(data, { options = {}, vssueData = {}, } = {}) {
        const { accessToken } = vssueData;
        data = data || {};
        if (accessToken) {
            data.access_token = accessToken;
        }
        console.log(`_handleRequestPost`, data, options, vssueData);
        return data;
    }
    /**
     * Handle authorization.
     *
     * @return A string for access token, `null` for no authorization code
     *
     * @see https://developer.github.com/apps/building-oauth-apps/authorizing-oauth-apps/
     *
     * @remarks
     * If the `code` and `state` exist in the query, and the `state` matches, remove them from query, and try to get the access token.
     */
    async handleAuth() {
        const query = parseQuery(window.location.search);
        if (query.code) {
            const { code, state } = this._chooseAuth(query);
            if (state !== this.state) {
                return null;
            }
            let u = new URL(window.location.href);
            u.searchParams.delete('code');
            u.searchParams.delete('state');
            window.history.replaceState(null, '', u.href);
            return this.getAccessToken({ code });
        }
        return null;
    }
    /**
     * Get user access token via `code`
     *
     * @param options.code - The code from the query
     *
     * @return User access token
     *
     * @see https://developer.github.com/apps/building-oauth-apps/authorizing-oauth-apps/#2-users-are-redirected-back-to-your-site-by-github
     */
    async getAccessToken({ code, }) {
        /**
         * access_token api does not support cors
         * @see https://github.com/isaacs/github/issues/330
         */
        const originalURL = concatURL(this.baseURL, 'oauth/token');
        const proxyURL = typeof this.proxy === 'function'
            ? this.proxy(originalURL)
            : this.proxy;
        const { data } = await this.$http.post(proxyURL, {
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: 'authorization_code',
            code,
            /**
             * useless but mentioned in docs
             */
            redirect_uri: window.location.href,
            // state: this.state,
            response_type: 'code',
            scope: this.scope,
        }, {
            headers: {
                'Accept': 'application/json',
            },
        });
        const { access_token } = data;
        this.$http.defaults.data = this.$http.defaults.data || {};
        this.$http.defaults.data.access_token = access_token;
        this.$http.defaults.headers = this.$http.defaults.headers || {};
        this.$http.defaults.headers['Authorization'] = `token ${access_token}`;
        return access_token;
    }
    /**
     * Get the logined user with access token.
     *
     * @param options.accessToken - User access token
     *
     * @return The user
     *
     * @see https://developer.github.com/v3/users/#get-the-authenticated-user
     */
    async getUser({ accessToken, }) {
        const { data } = await this.$http.request({
            url: 'user',
            params: {
            //access_token: accessToken,
            },
            data: {
                access_token: accessToken,
            },
            headers: { 'Authorization': `token ${accessToken}` },
        });
        return normalizeUser(data);
    }
    get _fullRepoPath() {
        return `${this.owner}/${this.repo}`;
    }
    /**
     * Get issue of this page according to the issue id or the issue title
     *
     * @param options.accessToken - User access token
     * @param options.issueId - The id of issue
     * @param options.issueTitle - The title of issue
     *
     * @return The raw response of issue
     *
     * @see https://developer.github.com/v3/issues/#list-issues-for-a-repository
     * @see https://developer.github.com/v3/issues/#get-a-single-issue
     * @see https://developer.github.com/v3/#pagination
     */
    async getIssue({ accessToken, issueId, issueTitle, }) {
        const options = {};
        console.log(`getIssue`, {
            accessToken,
            issueId,
            issueTitle,
        });
        if (accessToken) {
            options.headers = {
                'Authorization': `token ${accessToken}`,
            };
        }
        this._handleRequest(options, {
            accessToken,
        });
        if (issueId) {
            try {
                // to avoid caching
                options.params.timestamp = Date.now();
                options.params.state = 'all';
                const { data } = await this.$http.get(`repos/${this.owner}/${this.repo}/issues/${issueId}`, options);
                let issue = normalizeIssue(data);
                console.log(`getIssue`, 1, data, issue);
                return issue;
            }
            catch (e) {
                if (e.response && e.response.status === 404) {
                    return null;
                }
                else {
                    throw e;
                }
            }
        }
        else if (1) {
            let labels = this.labels;
            return await this.$http.get(`search/issues`, {
                params: this._handleRequestPost({
                    repo: this._fullRepoPath,
                    q: issueTitle,
                }, {
                    vssueData: {
                        accessToken,
                        issueId,
                        issueTitle,
                    },
                }),
            })
                .then(({ data }) => {
                let issue = data
                    .filter((issue) => {
                    return issue.title === issueTitle;
                })
                    .sort((a, b) => {
                    return a.labels.filter(k => labels.includes(k)).length
                        - b.labels.filter(k => labels.includes(k)).length;
                })[0];
                if (issue) {
                    return normalizeIssue(issue);
                }
                return null;
            });
        }
        else {
            options.params = {
                ...options.params,
                //labels: this.labels.join(','),
                sort: 'created',
                direction: 'asc',
                state: 'all',
                // to avoid caching
                timestamp: Date.now(),
            };
            const { data } = await this.$http.get(`repos/${this.owner}/${this.repo}/issues`, options);
            console.log(`getIssue`, 2.1, data, typeof data);
            console.log(this);
            const issue = data
                .map(normalizeIssue)
                .filter((issue) => {
                console.log([issue.title, issue.title === issueTitle, issue]);
                console.log(issue.labels);
                return issue.title === issueTitle;
            })[0];
            return issue || null;
        }
    }
    _handleApiError(e) {
        if (e && e.response && e.response.data && e.response.data.html_url && e.response.data.action) {
            setTimeout(() => {
                window.open(e.response.data.html_url, 'gitee');
            }, 1000);
        }
    }
    /**
     * Create a new issue
     *
     * @param options.accessToken - User access token
     * @param options.title - The title of issue
     * @param options.content - The content of issue
     *
     * @return The created issue
     *
     * @see https://developer.github.com/v3/issues/#create-an-issue
     */
    async postIssue({ accessToken, title, content, }) {
        const { data } = await Bluebird.resolve(this.$http.post(`repos/${this.owner}/issues`, this._handleRequestPost({
            title,
            body: content,
            repo: this.repo,
            labels: this.labels.join(','),
        }, {
            vssueData: {
                accessToken,
                title,
                content,
            },
        }), {
            headers: { 'Authorization': `token ${accessToken}` },
        }))
            .tapCatch(this._handleApiError);
        return normalizeIssue(data);
    }
    /**
     * Get comments of this page according to the issue id
     *
     * @param options.accessToken - User access token
     * @param options.issueId - The id of issue
     * @param options.query - The query parameters
     *
     * @return The comments
     *
     * @see https://developer.github.com/v3/issues/comments/#list-comments-on-an-issue
     * @see https://developer.github.com/v3/#pagination
     *
     * @reamrks
     * Github V3 does not support sort for issue comments now.
     * Github V3 have to request the parent issue to get the count of comments.
     */
    async getComments({ accessToken, issueId, query: { page = 1, perPage = 10, sort = 'desc', } = {}, }) {
        const issueOptions = {
            params: {
                // to avoid caching
                timestamp: Date.now(),
            },
        };
        const commentsOptions = {
            params: {
                // pagination
                'page': page,
                'per_page': perPage,
                /**
                 * github v3 api does not support sort for issue comments
                 * have sent feedback to github support
                 */
                // 'sort': 'created',
                // 'direction': sort,
                // to avoid caching
                'timestamp': Date.now(),
            },
            headers: {
                'Accept': [
                    'application/vnd.github.v3.raw+json',
                    'application/vnd.github.v3.html+json',
                    'application/vnd.github.squirrel-girl-preview',
                ],
            },
        };
        if (accessToken) {
            issueOptions.headers = {
                'Authorization': `token ${accessToken}`,
            };
            commentsOptions.headers['Authorization'] = `token ${accessToken}`;
        }
        // github v3 have to get the total count of comments by requesting the issue
        const [issueRes, commentsRes] = await Promise.all([
            this.$http.get(`repos/${this.owner}/${this.repo}/issues/${issueId}`, issueOptions),
            this.$http.get(`repos/${this.owner}/${this.repo}/issues/${issueId}/comments`, commentsOptions),
        ]);
        // it's annoying that have to get the page and per_page from the `Link` header
        const linkHeader = commentsRes.headers['link'] || null;
        /* istanbul ignore next */
        const thisPage = /rel="next"/.test(linkHeader)
            ? Number(linkHeader.replace(/^.*[^_]page=(\d*).*rel="next".*$/, '$1')) - 1
            : /rel="prev"/.test(linkHeader)
                ? Number(linkHeader.replace(/^.*[^_]page=(\d*).*rel="prev".*$/, '$1')) + 1
                : 1;
        /* istanbul ignore next */
        const thisPerPage = linkHeader ? Number(linkHeader.replace(/^.*per_page=(\d*).*$/, '$1')) : perPage;
        return {
            count: Number(issueRes.data.comments),
            page: thisPage,
            perPage: thisPerPage,
            data: commentsRes.data.map(normalizeComment),
        };
    }
    /**
     * Create a new comment
     *
     * @param options.accessToken - User access token
     * @param options.issueId - The id of issue
     * @param options.content - The content of comment
     *
     * @return The created comment
     *
     * @see https://developer.github.com/v3/issues/comments/#create-a-comment
     */
    async postComment({ accessToken, issueId, content, }) {
        const { data } = await Bluebird.resolve(this.$http.post(`repos/${this.owner}/${this.repo}/issues/${issueId}/comments`, {
            body: content,
        }, {
            headers: {
                'Authorization': `token ${accessToken}`,
                'Accept': [
                    'application/vnd.github.v3.raw+json',
                    'application/vnd.github.v3.html+json',
                    'application/vnd.github.squirrel-girl-preview',
                ],
            },
        }))
            .tapCatch(this._handleApiError);
        return normalizeComment(data);
    }
    /**
     * Edit a comment
     *
     * @param options.accessToken - User access token
     * @param options.commentId - The id of comment
     * @param options.content - The content of comment
     *
     * @return The edited comment
     *
     * @see https://developer.github.com/v3/issues/comments/#edit-a-comment
     */
    async putComment({ accessToken, commentId, content, }) {
        const { data } = await this.$http.patch(`repos/${this.owner}/${this.repo}/issues/comments/${commentId}`, {
            body: content,
        }, {
            headers: {
                'Authorization': `token ${accessToken}`,
                'Accept': [
                    'application/vnd.github.v3.raw+json',
                    'application/vnd.github.v3.html+json',
                    'application/vnd.github.squirrel-girl-preview',
                ],
            },
        });
        return normalizeComment(data);
    }
    /**
     * Delete a comment
     *
     * @param options.accessToken - User access token
     * @param options.commentId - The id of comment
     *
     * @return `true` if succeed, `false` if failed
     *
     * @see https://developer.github.com/v3/issues/comments/#delete-a-comment
     */
    async deleteComment({ accessToken, commentId, }) {
        const { status } = await this.$http.delete(`repos/${this.owner}/${this.repo}/issues/comments/${commentId}`, {
            headers: { 'Authorization': `token ${accessToken}` },
        });
        return status === 204;
    }
    /**
     * Get reactions of a comment
     *
     * @param options.accessToken - User access token
     * @param options.commentId - The id of comment
     *
     * @return The comments
     *
     * @see https://developer.github.com/v3/issues/comments/#get-a-single-comment
     * @see https://developer.github.com/v3/reactions/#list-reactions-for-an-issue-comment
     *
     * @remarks
     * The `List reactions for an issue comment` API also returns author of each reaction.
     * As we only need the count, use the `Get a single comment` API is much simpler.
     */
    async getCommentReactions({ accessToken, commentId, }) {
        const { data } = await this.$http.get(`repos/${this.owner}/${this.repo}/issues/comments/${commentId}`, {
            headers: {
                'Authorization': `token ${accessToken}`,
                'Accept': 'application/vnd.github.squirrel-girl-preview',
            },
        });
        return normalizeReactions(data.reactions);
    }
    /**
     * Create a new reaction of a comment
     *
     * @param options.accessToken - User access token
     * @param options.commentId - The id of comment
     * @param options.reaction - The reaction
     *
     * @return `true` if succeed, `false` if already token
     *
     * @see https://developer.github.com/v3/reactions/#create-reaction-for-an-issue-comment
     */
    async postCommentReaction({ accessToken, commentId, reaction, }) {
        const response = await this.$http.post(`repos/${this.owner}/${this.repo}/issues/comments/${commentId}/reactions`, {
            content: mapReactionName(reaction),
        }, {
            headers: {
                'Authorization': `token ${accessToken}`,
                'Accept': 'application/vnd.github.squirrel-girl-preview',
            },
        });
        return response.status === 201;
    }
}
__decorate([
    logMethod,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], VssueGiteeAPI.prototype, "handleAuth", null);
__decorate([
    logMethod,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VssueGiteeAPI.prototype, "getAccessToken", null);
__decorate([
    logMethod,
    noticeError,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VssueGiteeAPI.prototype, "getUser", null);
__decorate([
    logMethod,
    noticeError,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VssueGiteeAPI.prototype, "getIssue", null);
__decorate([
    logMethod,
    noticeError,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VssueGiteeAPI.prototype, "postIssue", null);
__decorate([
    logMethod,
    noticeError,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VssueGiteeAPI.prototype, "getComments", null);
__decorate([
    logMethod,
    noticeError,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VssueGiteeAPI.prototype, "postComment", null);
__decorate([
    logMethod,
    noticeError,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VssueGiteeAPI.prototype, "putComment", null);
__decorate([
    logMethod,
    noticeError,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VssueGiteeAPI.prototype, "deleteComment", null);
__decorate([
    logMethod,
    noticeError,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VssueGiteeAPI.prototype, "getCommentReactions", null);
__decorate([
    logMethod,
    noticeError,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VssueGiteeAPI.prototype, "postCommentReaction", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQSxPQUFPLGtCQUFrQixDQUFBO0FBRXpCLE9BQU8sS0FBd0QsTUFBTSxPQUFPLENBQUE7QUFDNUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLE1BQU0sY0FBYyxDQUFBO0FBQzlELE9BQU8sUUFBUSxNQUFNLFVBQVUsQ0FBQTtBQUMvQixPQUFPLEVBQ04sYUFBYSxFQUNiLGNBQWMsRUFDZCxnQkFBZ0IsRUFDaEIsa0JBQWtCLEVBQ2xCLGVBQWUsRUFBZSxTQUFTLEVBQUUsV0FBVyxHQUNwRCxNQUFNLFNBQVMsQ0FBQTtBQUVoQjs7R0FFRztBQUNILE1BQU0sQ0FBQyxPQUFPLE9BQU8sYUFBYTtJQXNCakMsWUFBWSxFQUNYLE9BQU8scUNBQXVCLEVBQzlCLEtBQUssRUFDTCxJQUFJLEVBQ0osTUFBTSxFQUNOLFFBQVEsRUFDUixZQUFZLEVBQ1osS0FBSyxFQUNMLEtBQUssR0FDYTtRQVhWLFVBQUssR0FBVyx3QkFBd0IsQ0FBQTtRQWFoRCxJQUFJLE9BQU8sWUFBWSxLQUFLLFdBQVcsRUFDdkM7WUFDQyxNQUFNLElBQUksS0FBSyxDQUFDLGdDQUFnQyx1QkFBcUIsRUFBRSxDQUFDLENBQUE7U0FDeEU7UUFDRCxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQTtRQUN0QixJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQTtRQUNsQixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQTtRQUNoQixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQTtRQUVwQixJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQTtRQUN4QixJQUFJLENBQUMsWUFBWSxHQUFHLFlBQVksQ0FBQTtRQUNoQyxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQTtRQUNsQixJQUFJLENBQUMsS0FBSyxH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LFFBQVEsRUFBRSw4Q0FBOEM7YUFDeEQ7U0FDRCxDQUFDLENBQUE7UUFDRixPQUFPLFFBQVEsQ0FBQyxNQUFNLEtBQUssR0FBRyxDQUFBO0lBQy9CLENBQUM7Q0FFRDtBQWxsQkE7SUFEQyxTQUFTOzs7OytDQXVCVDtBQVlEO0lBREMsU0FBUzs7OzttREErQ1Q7QUFhRDtJQUZDLFNBQVM7SUFDVCxXQUFXOzs7OzRDQXNCWDtBQXNCRDtJQUZDLFNBQVM7SUFDVCxXQUFXOzs7OzZDQW9JWDtBQTBCRDtJQUZDLFNBQVM7SUFDVCxXQUFXOzs7OzhDQTZCWDtBQW9CRDtJQUZDLFNBQVM7SUFDVCxXQUFXOzs7O2dEQTRFWDtBQWVEO0lBRkMsU0FBUztJQUNULFdBQVc7Ozs7Z0RBMEJYO0FBZUQ7SUFGQyxTQUFTO0lBQ1QsV0FBVzs7OzsrQ0F5Qlg7QUFjRDtJQUZDLFNBQVM7SUFDVCxXQUFXOzs7O2tEQWNYO0FBbUJEO0lBRkMsU0FBUztJQUNULFdBQVc7Ozs7d0RBaUJYO0FBZUQ7SUFGQyxTQUFTO0lBQ1QsV0FBVzs7Ozt3REFxQlgiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgJ3JlZmxlY3QtbWV0YWRhdGEnXG5pbXBvcnQgeyBWc3N1ZUFQSSB9IGZyb20gJ3Zzc3VlJ1xuaW1wb3J0IGF4aW9zLCB7IEF4aW9zSW5zdGFuY2UsIEF4aW9zUmVxdWVzdENvbmZpZywgQXhpb3NFcnJvciB9IGZyb20gJ2F4aW9zJ1xuaW1wb3J0IHsgYnVpbGRVUkwsIGNvbmNhdFVSTCwgcGFyc2VRdWVyeSB9IGZyb20gJ0B2c3N1ZS91dGlscydcbmltcG9ydCBCbHVlYmlyZCBmcm9tICdibHVlYmlyZCdcbmltcG9ydCB7XG5cdG5vcm1hbGl6ZVVzZXIsXG5cdG5vcm1hbGl6ZUlzc3VlLFxuXHRub3JtYWxpemVDb21tZW50LFxuXHRub3JtYWxpemVSZWFjdGlvbnMsXG5cdG1hcFJlYWN0aW9uTmFtZSwgRW51bU15Q29uc3QsIGxvZ01ldGhvZCwgbm90aWNlRXJyb3IsIElJc3N1ZXMsXG59IGZyb20gJy4vdXRpbHMnXG5cbi8qKlxuICogQHNlZSBodHRwczovL2dpdGVlLmNvbS9hcGkvdjUvb2F1dGhfZG9jXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFZzc3VlR2l0ZWVBUEkgaW1wbGVtZW50cyBWc3N1ZUFQSS5JbnN0YW5jZVxue1xuXHRiYXNlVVJMOiBzdHJpbmdcblx0b3duZXI6IHN0cmluZ1xuXHRyZXBvOiBzdHJpbmdcblx0bGFiZWxzOiBBcnJheTxzdHJpbmc+XG5cdGNsaWVudElkOiBzdHJpbmdcblx0Y2xpZW50U2VjcmV0OiBzdHJpbmdcblx0c3RhdGU6IHN0cmluZ1xuXHRwcm94eTogc3RyaW5nIHwgKCh1cmw6IHN0cmluZykgPT4gc3RyaW5nKVxuXHQkaHR0cDogQXhpb3NJbnN0YW5jZVxuXG5cdHByaXZhdGUgX3BhZ2VJbmZvOiB7XG5cdFx0cGFnZTogbnVtYmVyXG5cdFx0c3RhcnRDdXJzb3I6IHN0cmluZyB8IG51bGxcblx0XHRlbmRDdXJzb3I6IHN0cmluZyB8IG51bGxcblx0XHRzb3J0OiBzdHJpbmcgfCBudWxsXG5cdFx0cGVyUGFnZTogbnVtYmVyIHwgbnVsbFxuXHR9XG5cblx0cmVhZG9ubHkgc2NvcGU6IHN0cmluZyA9ICd1c2VyX2luZm8gaXNzdWVzIG5vdGVzJ1xuXG5cdGNvbnN0cnVjdG9yKHtcblx0XHRiYXNlVVJMID0gRW51bU15Q29uc3QuQkFTRV9VUkwsXG5cdFx0b3duZXIsXG5cdFx0cmVwbyxcblx0XHRsYWJlbHMsXG5cdFx0Y2xpZW50SWQsXG5cdFx0Y2xpZW50U2VjcmV0LFxuXHRcdHN0YXRlLFxuXHRcdHByb3h5LFxuXHR9OiBWc3N1ZUFQSS5PcHRpb25zKVxuXHR7XG5cdFx0aWYgKHR5cGVvZiBjbGllbnRTZWNyZXQgPT09ICd1bmRlZmluZWQnKVxuXHRcdHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgY2xpZW50U2VjcmV0IGlzIHJlcXVpcmVkIGZvciAke0VudW1NeUNvbnN0LlNJVEVfTkFNRX1gKVxuXHRcdH1cblx0XHR0aGlzLmJhc2VVUkwgPSBiYXNlVVJMXG5cdFx0dGhpcy5vd25lciA9IG93bmVyXG5cdFx0dGhpcy5yZXBvID0gcmVwb1xuXHRcdHRoaXMubGFiZWxzID0gbGFiZWxzXG5cblx0XHR0aGlzLmNsaWVudElkID0gY2xpZW50SWRcblx0XHR0aGlzLmNsaWVudFNlY3JldCA9IGNsaWVudFNlY3JldFxuXHRcdHRoaXMuc3RhdGUgPSBzdGF0ZVxuXHRcdHRoaXMucHJveHkgPSBwcm94eVxuXG5cdFx0dGhpcy5fcGFnZUluZm8gPSB7XG5cdFx0XHRwYWdlOiAxLFxuXHRcdFx0c3RhcnRDdXJzb3I6IG51bGwsXG5cdFx0XHRlbmRDdXJzb3I6IG51bGwsXG5cdFx0XHRzb3J0OiBudWxsLFxuXHRcdFx0cGVyUGFnZTogbnVsbCxcblx0XHR9O1xuXG5cdFx0dGhpcy4kaHR0cCA9IGF4aW9zLmNyZWF0ZSh7XG5cdFx0XHRiYXNlVVJMOiBjb25jYXRVUkwoYmFzZVVSTCwgJ2FwaS92NScpLFxuXHRcdFx0aGVhZGVyczoge1xuXHRcdFx0XHQnQWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuXHRcdFx0fSxcblx0XHR9KTtcblxuXHRcdHRoaXMuJGh0dHAuaW50ZXJjZXB0b3JzLnJlc3BvbnNlLnVzZShyZXNwb25zZSA9PlxuXHRcdHtcblx0XHRcdGlmIChyZXNwb25zZS5kYXRhLmVycm9yKVxuXHRcdFx0e1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QocmVzcG9uc2UuZGF0YS5lcnJvcl9kZXNjcmlwdGlvbilcblx0XHRcdH1cblx0XHRcdGlmIChyZXNwb25zZS5kYXRhLmVycm9ycylcblx0XHRcdHtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KHJlc3BvbnNlLmRhdGEuZXJyb3JzWzBdLm1lc3NhZ2UpXG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzcG9uc2Vcblx0XHR9KVxuXHR9XG5cblx0LyoqXG5cdCAqIFRoZSBwbGF0Zm9ybSBhcGkgaW5mb1xuXHQgKi9cblx0Z2V0IHBsYXRmb3JtKCk6IFZzc3VlQVBJLlBsYXRmb3JtXG5cdHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZTogRW51bU15Q29uc3QuU0lURV9OQU1FLFxuXHRcdFx0bGluazogdGhpcy5iYXNlVVJMLFxuXHRcdFx0dmVyc2lvbjogJ3Y1Jyxcblx0XHRcdG1ldGE6IHtcblx0XHRcdFx0cmVhY3RhYmxlOiBmYWxzZSxcblx0XHRcdFx0c29ydGFibGU6IHRydWUsXG5cdFx0XHR9LFxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBSZWRpcmVjdCB0byB0aGUgYXV0aG9yaXphdGlvbiBwYWdlIG9mIHBsYXRmb3JtLlxuXHQgKlxuXHQgKiBAc2VlIGh0dHBzOi8vZGV2ZWxvcGVyLmdpdGh1Yi5jb20vYXBwcy9idWlsZGluZy1vYXV0aC1hcHBzL2F1dGhvcml6aW5nLW9hdXRoLWFwcHMvIzEtcmVxdWVzdC1hLXVzZXJzLWdpdGh1Yi1pZGVudGl0eVxuXHQgKi9cblx0cmVkaXJlY3RBdXRoKCk6IHZvaWRcblx0e1xuXHRcdHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gYnVpbGRVUkwoY29uY2F0VVJMKHRoaXMuYmFzZVVSTCwgJ29hdXRoL2F1dGhvcml6ZScpLCB7XG5cdFx0XHRjbGllbnRfaWQ6IHRoaXMuY2xpZW50SWQsXG5cdFx0XHRyZWRpcmVjdF91cmk6IHdpbmRvdy5sb2NhdGlvbi5ocmVmLFxuXHRcdFx0c2NvcGU6IHRoaXMuc2NvcGUsXG5cdFx0XHRzdGF0ZTogdGhpcy5zdGF0ZSxcblx0XHRcdHJlc3BvbnNlX3R5cGU6ICdjb2RlJyxcblx0XHR9KVxuXHR9XG5cblx0cHJvdGVjdGVkIF9jaG9vc2VBdXRoKHF1ZXJ5OiB7XG5cdFx0Y29kZTogc3RyaW5nIHwgc3RyaW5nW10sXG5cdFx0c3RhdGU6IHN0cmluZyB8IHN0cmluZ1tdLFxuXHR9KToge1xuXHRcdGNvZGU6IHN0cmluZztcblx0XHRzdGF0ZTogc3RyaW5nO1xuXHR9XG5cdHtcblx0XHRpZiAoQXJyYXkuaXNBcnJheShxdWVyeS5zdGF0ZSkgfHwgQXJyYXkuaXNBcnJheShxdWVyeS5jb2RlKSlcblx0XHR7XG5cdFx0XHRmb3IgKGxldCBpIGluIChxdWVyeS5zdGF0ZSBhcyBzdHJpbmdbXSkpXG5cdFx0XHR7XG5cdFx0XHRcdGlmIChxdWVyeS5zdGF0ZVtpXSA9PT0gdGhpcy5zdGF0ZSAmJiBxdWVyeS5jb2RlW2ldKVxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGNvZGU6IHF1ZXJ5LmNvZGVbaV0gYXMgc3RyaW5nLFxuXHRcdFx0XHRcdFx0c3RhdGU6IHF1ZXJ5LnN0YXRlW2ldIGFzIHN0cmluZyxcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGNvZGU6IHF1ZXJ5LmNvZGUgYXMgc3RyaW5nLFxuXHRcdFx0c3RhdGU6IHF1ZXJ5LnN0YXRlIGFzIHN0cmluZyxcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2hhbmRsZVJlcXVlc3Qob3B0aW9uczogQXhpb3NSZXF1ZXN0Q29uZmlnICYge1xuXHRcdGRhdGE/OiB7XG5cdFx0XHRhY2Nlc3NfdG9rZW4/OiBzdHJpbmc7XG5cdFx0fVxuXHR9LCB2c3N1ZURhdGE6IHtcblx0XHRhY2Nlc3NUb2tlbj86IHN0cmluZztcblx0XHRbazogc3RyaW5nXTogdW5rbm93bjtcblx0fSA9IHt9KVxuXHR7XG5cdFx0Y29uc3QgeyBhY2Nlc3NUb2tlbiB9ID0gdnNzdWVEYXRhO1xuXG5cdFx0b3B0aW9ucy5wYXJhbXMgPSBvcHRpb25zLnBhcmFtcyB8fCB7fTtcblx0XHRvcHRpb25zLmRhdGEgPSB0aGlzLl9oYW5kbGVSZXF1ZXN0UG9zdChvcHRpb25zLmRhdGEsIHtcblx0XHRcdG9wdGlvbnMsIHZzc3VlRGF0YSxcblx0XHR9KTtcblxuXHRcdG9wdGlvbnMuaGVhZGVycyA9IG9wdGlvbnMuaGVhZGVycyB8fCB7fTtcblxuXHRcdGlmIChhY2Nlc3NUb2tlbilcblx0XHR7XG5cdFx0XHRvcHRpb25zLmhlYWRlcnNbJ0F1dGhvcml6YXRpb24nXSA9IGB0b2tlbiAke2FjY2Vzc1Rva2VufWA7XG5cblx0XHRcdGlmICghb3B0aW9ucy5tZXRob2QgfHwgb3B0aW9ucy5tZXRob2QudG9Mb3dlckNhc2UoKSAhPSAncG9zdCcpXG5cdFx0XHR7XG5cdFx0XHRcdG9wdGlvbnMucGFyYW1zLmFjY2Vzc190b2tlbiA9IGFjY2Vzc1Rva2VuO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBvcHRpb25zO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9oYW5kbGVSZXF1ZXN0UG9zdChkYXRhOiBBeGlvc1JlcXVlc3RDb25maWdbXCJkYXRhXCJdICYge1xuXHRcdGFjY2Vzc190b2tlbj86IHN0cmluZztcblx0fSwge1xuXHRcdG9wdGlvbnMgPSB7fSBhcyBBeGlvc1JlcXVlc3RDb25maWcsXG5cdFx0dnNzdWVEYXRhID0ge30gYXMge1xuXHRcdFx0YWNjZXNzVG9rZW4/OiBzdHJpbmc7XG5cdFx0XHRbazogc3RyaW5nXTogdW5rbm93bjtcblx0XHR9LFxuXHR9ID0ge30pXG5cdHtcblx0XHRjb25zdCB7IGFjY2Vzc1Rva2VuIH0gPSB2c3N1ZURhdGE7XG5cblx0XHRkYXRhID0gZGF0YSB8fCB7fTtcblxuXHRcdGlmIChhY2Nlc3NUb2tlbilcblx0XHR7XG5cdFx0XHRkYXRhLmFjY2Vzc190b2tlbiA9IGFjY2Vzc1Rva2VuO1xuXHRcdH1cblxuXHRcdGNvbnNvbGUubG9nKGBfaGFuZGxlUmVxdWVzdFBvc3RgLCBkYXRhLCBvcHRpb25zLCB2c3N1ZURhdGEpO1xuXG5cdFx0cmV0dXJuIGRhdGE7XG5cdH1cblxuXHQvKipcblx0ICogSGFuZGxlIGF1dGhvcml6YXRpb24uXG5cdCAqXG5cdCAqIEByZXR1cm4gQSBzdHJpbmcgZm9yIGFjY2VzcyB0b2tlbiwgYG51bGxgIGZvciBubyBhdXRob3JpemF0aW9uIGNvZGVcblx0ICpcblx0ICogQHNlZSBodHRwczovL2RldmVsb3Blci5naXRodWIuY29tL2FwcHMvYnVpbGRpbmctb2F1dGgtYXBwcy9hdXRob3JpemluZy1vYXV0aC1hcHBzL1xuXHQgKlxuXHQgKiBAcmVtYXJrc1xuXHQgKiBJZiB0aGUgYGNvZGVgIGFuZCBgc3RhdGVgIGV4aXN0IGluIHRoZSBxdWVyeSwgYW5kIHRoZSBgc3RhdGVgIG1hdGNoZXMsIHJlbW92ZSB0aGVtIGZyb20gcXVlcnksIGFuZCB0cnkgdG8gZ2V0IHRoZSBhY2Nlc3MgdG9rZW4uXG5cdCAqL1xuXHRAbG9nTWV0aG9kXG5cdGFzeW5jIGhhbmRsZUF1dGgoKTogUHJvbWlzZTxWc3N1ZUFQSS5BY2Nlc3NUb2tlbj5cblx0e1xuXHRcdGNvbnN0IHF1ZXJ5ID0gcGFyc2VRdWVyeSh3aW5kb3cubG9jYXRpb24uc2VhcmNoKVxuXG5cdFx0aWYgKHF1ZXJ5LmNvZGUpXG5cdFx0e1xuXHRcdFx0Y29uc3QgeyBjb2RlLCBzdGF0ZSB9ID0gdGhpcy5fY2hvb3NlQXV0aChxdWVyeSk7XG5cblx0XHRcdGlmIChzdGF0ZSAhPT0gdGhpcy5zdGF0ZSlcblx0XHRcdHtcblx0XHRcdFx0cmV0dXJuIG51bGxcblx0XHRcdH1cblxuXHRcdFx0bGV0IHUgPSBuZXcgVVJMKHdpbmRvdy5sb2NhdGlvbi5ocmVmKTtcblx0XHRcdHUuc2VhcmNoUGFyYW1zLmRlbGV0ZSgnY29kZScpO1xuXHRcdFx0dS5zZWFyY2hQYXJhbXMuZGVsZXRlKCdzdGF0ZScpO1xuXHRcdFx0d2luZG93Lmhpc3RvcnkucmVwbGFjZVN0YXRlKG51bGwsICcnLCB1LmhyZWYpO1xuXG5cdFx0XHRyZXR1cm4gdGhpcy5nZXRBY2Nlc3NUb2tlbih7IGNvZGUgfSlcblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbFxuXHR9XG5cblx0LyoqXG5cdCAqIEdldCB1c2VyIGFjY2VzcyB0b2tlbiB2aWEgYGNvZGVgXG5cdCAqXG5cdCAqIEBwYXJhbSBvcHRpb25zLmNvZGUgLSBUaGUgY29kZSBmcm9tIHRoZSBxdWVyeVxuXHQgKlxuXHQgKiBAcmV0dXJuIFVzZXIgYWNjZXNzIHRva2VuXG5cdCAqXG5cdCAqIEBzZWUgaHR0cHM6Ly9kZXZlbG9wZXIuZ2l0aHViLmNvbS9hcHBzL2J1aWxkaW5nLW9hdXRoLWFwcHMvYXV0aG9yaXppbmctb2F1dGgtYXBwcy8jMi11c2Vycy1hcmUtcmVkaXJlY3RlZC1iYWNrLXRvLXlvdXItc2l0ZS1ieS1naXRodWJcblx0ICovXG5cdEBsb2dNZXRob2Rcblx0YXN5bmMgZ2V0QWNjZXNzVG9rZW4oe1xuXHRcdGNvZGUsXG5cdH06IHtcblx0XHRjb2RlOiBzdHJpbmdcblx0fSk6IFByb21pc2U8c3RyaW5nPlxuXHR7XG5cdFx0LyoqXG5cdFx0ICogYWNjZXNzX3Rva2VuIGFwaSBkb2VzIG5vdCBzdXBwb3J0IGNvcnNcblx0XHQgKiBAc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9pc2FhY3MvZ2l0aHViL2lzc3Vlcy8zMzBcblx0XHQgKi9cblx0XHRjb25zdCBvcmlnaW5hbFVSTCA9IGNvbmNhdFVSTCh0aGlzLmJhc2VVUkwsICdvYXV0aC90b2tlbicpXG5cdFx0Y29uc3QgcHJveHlVUkwgPSB0eXBlb2YgdGhpcy5wcm94eSA9PT0gJ2Z1bmN0aW9uJ1xuXHRcdFx0PyB0aGlzLnByb3h5KG9yaWdpbmFsVVJMKVxuXHRcdFx0OiB0aGlzLnByb3h5XG5cdFx0Y29uc3QgeyBkYXRhIH0gPSBhd2FpdCB0aGlzLiRodHRwLnBvc3QocHJveHlVUkwsIHtcblx0XHRcdGNsaWVudF9pZDogdGhpcy5jbGllbnRJZCxcblx0XHRcdGNsaWVudF9zZWNyZXQ6IHRoaXMuY2xpZW50U2VjcmV0LFxuXG5cdFx0XHRncmFudF90eXBlOiAnYXV0aG9yaXphdGlvbl9jb2RlJyxcblxuXHRcdFx0Y29kZSxcblx0XHRcdC8qKlxuXHRcdFx0ICogdXNlbGVzcyBidXQgbWVudGlvbmVkIGluIGRvY3Ncblx0XHRcdCAqL1xuXHRcdFx0cmVkaXJlY3RfdXJpOiB3aW5kb3cubG9jYXRpb24uaHJlZixcblx0XHRcdC8vIHN0YXRlOiB0aGlzLnN0YXRlLFxuXHRcdFx0cmVzcG9uc2VfdHlwZTogJ2NvZGUnLFxuXHRcdFx0c2NvcGU6IHRoaXMuc2NvcGUsXG5cdFx0fSwge1xuXG5cdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdCdBY2NlcHQnOiAnYXBwbGljYXRpb24vanNvbicsXG5cdFx0XHR9LFxuXG5cdFx0fSk7XG5cblx0XHRjb25zdCB7IGFjY2Vzc190b2tlbiB9ID0gZGF0YTtcblxuXHRcdHRoaXMuJGh0dHAuZGVmYXVsdHMuZGF0YSA9IHRoaXMuJGh0dHAuZGVmYXVsdHMuZGF0YSB8fCB7fTtcblx0XHR0aGlzLiRodHRwLmRlZmF1bHRzLmRhdGEuYWNjZXNzX3Rva2VuID0gYWNjZXNzX3Rva2VuO1xuXG5cdFx0dGhpcy4kaHR0cC5kZWZhdWx0cy5oZWFkZXJzID0gdGhpcy4kaHR0cC5kZWZhdWx0cy5oZWFkZXJzIHx8IHt9O1xuXG5cdFx0dGhpcy4kaHR0cC5kZWZhdWx0cy5oZWFkZXJzWydBdXRob3JpemF0aW9uJ10gPSBgdG9rZW4gJHthY2Nlc3NfdG9rZW59YDtcblxuXHRcdHJldHVybiBhY2Nlc3NfdG9rZW5cblx0fVxuXG5cdC8qKlxuXHQgKiBHZXQgdGhlIGxvZ2luZWQgdXNlciB3aXRoIGFjY2VzcyB0b2tlbi5cblx0ICpcblx0ICogQHBhcmFtIG9wdGlvbnMuYWNjZXNzVG9rZW4gLSBVc2VyIGFjY2VzcyB0b2tlblxuXHQgKlxuXHQgKiBAcmV0dXJuIFRoZSB1c2VyXG5cdCAqXG5cdCAqIEBzZWUgaHR0cHM6Ly9kZXZlbG9wZXIuZ2l0aHViLmNvbS92My91c2Vycy8jZ2V0LXRoZS1hdXRoZW50aWNhdGVkLXVzZXJcblx0ICovXG5cdEBsb2dNZXRob2Rcblx0QG5vdGljZUVycm9yXG5cdGFzeW5jIGdldFVzZXIoe1xuXHRcdGFjY2Vzc1Rva2VuLFxuXHR9OiB7XG5cdFx0YWNjZXNzVG9rZW46IFZzc3VlQVBJLkFjY2Vzc1Rva2VuXG5cdH0pOiBQcm9taXNlPFZzc3VlQVBJLlVzZXI+XG5cdHtcblx0XHRjb25zdCB7IGRhdGEgfSA9IGF3YWl0IHRoaXMuJGh0dHAucmVxdWVzdCh7XG5cblx0XHRcdHVybDogJ3VzZXInLFxuXG5cdFx0XHRwYXJhbXM6IHtcblx0XHRcdFx0Ly9hY2Nlc3NfdG9rZW46IGFjY2Vzc1Rva2VuLFxuXHRcdFx0fSxcblxuXHRcdFx0ZGF0YToge1xuXHRcdFx0XHRhY2Nlc3NfdG9rZW46IGFjY2Vzc1Rva2VuLFxuXHRcdFx0fSxcblxuXHRcdFx0aGVhZGVyczogeyAnQXV0aG9yaXphdGlvbic6IGB0b2tlbiAke2FjY2Vzc1Rva2VufWAgfSxcblx0XHR9KVxuXHRcdHJldHVybiBub3JtYWxpemVVc2VyKGRhdGEpXG5cdH1cblxuXHRnZXQgX2Z1bGxSZXBvUGF0aCgpXG5cdHtcblx0XHRyZXR1cm4gYCR7dGhpcy5vd25lcn0vJHt0aGlzLnJlcG99YDtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXQgaXNzdWUgb2YgdGhpcyBwYWdlIGFjY29yZGluZyB0byB0aGUgaXNzdWUgaWQgb3IgdGhlIGlzc3VlIHRpdGxlXG5cdCAqXG5cdCAqIEBwYXJhbSBvcHRpb25zLmFjY2Vzc1Rva2VuIC0gVXNlciBhY2Nlc3MgdG9rZW5cblx0ICogQHBhcmFtIG9wdGlvbnMuaXNzdWVJZCAtIFRoZSBpZCBvZiBpc3N1ZVxuXHQgKiBAcGFyYW0gb3B0aW9ucy5pc3N1ZVRpdGxlIC0gVGhlIHRpdGxlIG9mIGlzc3VlXG5cdCAqXG5cdCAqIEByZXR1cm4gVGhlIHJhdyByZXNwb25zZSBvZiBpc3N1ZVxuXHQgKlxuXHQgKiBAc2VlIGh0dHBzOi8vZGV2ZWxvcGVyLmdpdGh1Yi5jb20vdjMvaXNzdWVzLyNsaXN0LWlzc3Vlcy1mb3ItYS1yZXBvc2l0b3J5XG5cdCAqIEBzZWUgaHR0cHM6Ly9kZXZlbG9wZXIuZ2l0aHViLmNvbS92My9pc3N1ZXMvI2dldC1hLXNpbmdsZS1pc3N1ZVxuXHQgKiBAc2VlIGh0dHBzOi8vZGV2ZWxvcGVyLmdpdGh1Yi5jb20vdjMvI3BhZ2luYXRpb25cblx0ICovXG5cdEBsb2dNZXRob2Rcblx0QG5vdGljZUVycm9yXG5cdGFzeW5jIGdldElzc3VlKHtcblx0XHRhY2Nlc3NUb2tlbixcblx0XHRpc3N1ZUlkLFxuXHRcdGlzc3VlVGl0bGUsXG5cdH06IHtcblx0XHRhY2Nlc3NUb2tlbjogVnNzdWVBUEkuQWNjZXNzVG9rZW5cblx0XHRpc3N1ZUlkPzogc3RyaW5nIHwgbnVtYmVyXG5cdFx0aXNzdWVUaXRsZT86IHN0cmluZ1xuXHR9KTogUHJvbWlzZTxWc3N1ZUFQSS5Jc3N1ZSB8IG51bGw+XG5cdHtcblx0XHRjb25zdCBvcHRpb25zOiBBeGlvc1JlcXVlc3RDb25maWcgPSB7fVxuXG5cdFx0Y29uc29sZS5sb2coYGdldElzc3VlYCwge1xuXHRcdFx0YWNjZXNzVG9rZW4sXG5cdFx0XHRpc3N1ZUlkLFxuXHRcdFx0aXNzdWVUaXRsZSxcblx0XHR9KTtcblxuXHRcdGlmIChhY2Nlc3NUb2tlbilcblx0XHR7XG5cdFx0XHRvcHRpb25zLmhlYWRlcnMgPSB7XG5cdFx0XHRcdCdBdXRob3JpemF0aW9uJzogYHRva2VuICR7YWNjZXNzVG9rZW59YCxcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl9oYW5kbGVSZXF1ZXN0KG9wdGlvbnMsIHtcblx0XHRcdGFjY2Vzc1Rva2VuLFxuXHRcdH0pO1xuXG5cdFx0aWYgKGlzc3VlSWQpXG5cdFx0e1xuXHRcdFx0dHJ5XG5cdFx0XHR7XG5cdFx0XHRcdC8vIHRvIGF2b2lkIGNhY2hpbmdcblx0XHRcdFx0b3B0aW9ucy5wYXJhbXMudGltZXN0YW1wID0gRGF0ZS5ub3coKTtcblx0XHRcdFx0b3B0aW9ucy5wYXJhbXMuc3RhdGUgPSAnYWxsJztcblxuXHRcdFx0XHRjb25zdCB7IGRhdGEgfSA9IGF3YWl0IHRoaXMuJGh0dHAuZ2V0KGByZXBvcy8ke3RoaXMub3duZXJ9LyR7dGhpcy5yZXBvfS9pc3N1ZXMvJHtpc3N1ZUlkfWAsIG9wdGlvbnMpXG5cblx0XHRcdFx0bGV0IGlzc3VlID0gbm9ybWFsaXplSXNzdWUoZGF0YSlcblxuXHRcdFx0XHRjb25zb2xlLmxvZyhgZ2V0SXNzdWVgLCAxLCBkYXRhLCBpc3N1ZSk7XG5cblx0XHRcdFx0cmV0dXJuIGlzc3VlXG5cdFx0XHR9XG5cdFx0XHRjYXRjaCAoZSlcblx0XHRcdHtcblx0XHRcdFx0aWYgKGUucmVzcG9uc2UgJiYgZS5yZXNwb25zZS5zdGF0dXMgPT09IDQwNClcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHJldHVybiBudWxsXG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZVxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0dGhyb3cgZVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGVsc2UgaWYgKDEpXG5cdFx0e1xuXHRcdFx0bGV0IGxhYmVscyA9IHRoaXMubGFiZWxzO1xuXG5cdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy4kaHR0cC5nZXQoYHNlYXJjaC9pc3N1ZXNgLCB7XG5cblx0XHRcdFx0XHRwYXJhbXM6IHRoaXMuX2hhbmRsZVJlcXVlc3RQb3N0KHtcblxuXHRcdFx0XHRcdFx0cmVwbzogdGhpcy5fZnVsbFJlcG9QYXRoLFxuXG5cdFx0XHRcdFx0XHRxOiBpc3N1ZVRpdGxlLFxuXHRcdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRcdHZzc3VlRGF0YToge1xuXHRcdFx0XHRcdFx0XHRhY2Nlc3NUb2tlbixcblx0XHRcdFx0XHRcdFx0aXNzdWVJZCxcblx0XHRcdFx0XHRcdFx0aXNzdWVUaXRsZSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0fSksXG5cblx0XHRcdFx0fSlcblx0XHRcdFx0LnRoZW4oKHsgZGF0YSB9KSA9PlxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bGV0IGlzc3VlID0gKGRhdGEgYXMgSUlzc3Vlc1tdKVxuXHRcdFx0XHRcdFx0LmZpbHRlcigoaXNzdWU6IElJc3N1ZXMpID0+XG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBpc3N1ZS50aXRsZSA9PT0gaXNzdWVUaXRsZVxuXHRcdFx0XHRcdFx0fSlcblx0XHRcdFx0XHRcdC5zb3J0KChhLCBiKSA9PlxuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gYS5sYWJlbHMuZmlsdGVyKGsgPT4gbGFiZWxzLmluY2x1ZGVzKGspKS5sZW5ndGhcblx0XHRcdFx0XHRcdFx0XHQtIGIubGFiZWxzLmZpbHRlcihrID0+IGxhYmVscy5pbmNsdWRlcyhrKSkubGVuZ3RoXG5cdFx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdFx0WzBdXG5cdFx0XHRcdFx0O1xuXG5cdFx0XHRcdFx0aWYgKGlzc3VlKVxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHJldHVybiBub3JtYWxpemVJc3N1ZShpc3N1ZSlcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gbnVsbFxuXHRcdFx0XHR9KVxuXHRcdFx0XHQ7XG5cdFx0fVxuXHRcdGVsc2Vcblx0XHR7XG5cdFx0XHRvcHRpb25zLnBhcmFtcyA9IHtcblx0XHRcdFx0Li4ub3B0aW9ucy5wYXJhbXMsXG5cdFx0XHRcdC8vbGFiZWxzOiB0aGlzLmxhYmVscy5qb2luKCcsJyksXG5cdFx0XHRcdHNvcnQ6ICdjcmVhdGVkJyxcblx0XHRcdFx0ZGlyZWN0aW9uOiAnYXNjJyxcblx0XHRcdFx0c3RhdGU6ICdhbGwnLFxuXHRcdFx0XHQvLyB0byBhdm9pZCBjYWNoaW5nXG5cdFx0XHRcdHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcblx0XHRcdH1cblx0XHRcdGNvbnN0IHsgZGF0YSB9ID0gYXdhaXQgdGhpcy4kaHR0cC5nZXQoYHJlcG9zLyR7dGhpcy5vd25lcn0vJHt0aGlzLnJlcG99L2lzc3Vlc2AsIG9wdGlvbnMpO1xuXG5cdFx0XHRjb25zb2xlLmxvZyhgZ2V0SXNzdWVgLCAyLjEsIGRhdGEsIHR5cGVvZiBkYXRhKTtcblx0XHRcdGNvbnNvbGUubG9nKHRoaXMpO1xuXG5cdFx0XHRjb25zdCBpc3N1ZSA9IGRhdGFcblx0XHRcdFx0Lm1hcChub3JtYWxpemVJc3N1ZSlcblx0XHRcdFx0LmZpbHRlcigoaXNzdWU6IElJc3N1ZXMpID0+XG5cdFx0XHRcdHtcblx0XHRcdFx0XHRjb25zb2xlLmxvZyhbaXNzdWUudGl0bGUsIGlzc3VlLnRpdGxlID09PSBpc3N1ZVRpdGxlLCBpc3N1ZV0pO1xuXG5cdFx0XHRcdFx0Y29uc29sZS5sb2coaXNzdWUubGFiZWxzKTtcblxuXHRcdFx0XHRcdHJldHVybiBpc3N1ZS50aXRsZSA9PT0gaXNzdWVUaXRsZVxuXHRcdFx0XHR9KVswXVxuXHRcdFx0O1xuXG5cdFx0XHRyZXR1cm4gaXNzdWUgfHwgbnVsbFxuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBfaGFuZGxlQXBpRXJyb3IoZTogQXhpb3NFcnJvcilcblx0e1xuXHRcdGlmIChlICYmIGUucmVzcG9uc2UgJiYgZS5yZXNwb25zZS5kYXRhICYmIGUucmVzcG9uc2UuZGF0YS5odG1sX3VybCAmJiBlLnJlc3BvbnNlLmRhdGEuYWN0aW9uKVxuXHRcdHtcblx0XHRcdHNldFRpbWVvdXQoKCkgPT5cblx0XHRcdHtcblx0XHRcdFx0d2luZG93Lm9wZW4oZS5yZXNwb25zZS5kYXRhLmh0bWxfdXJsLCAnZ2l0ZWUnKVxuXHRcdFx0fSwgMTAwMCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBhIG5ldyBpc3N1ZVxuXHQgKlxuXHQgKiBAcGFyYW0gb3B0aW9ucy5hY2Nlc3NUb2tlbiAtIFVzZXIgYWNjZXNzIHRva2VuXG5cdCAqIEBwYXJhbSBvcHRpb25zLnRpdGxlIC0gVGhlIHRpdGxlIG9mIGlzc3VlXG5cdCAqIEBwYXJhbSBvcHRpb25zLmNvbnRlbnQgLSBUaGUgY29udGVudCBvZiBpc3N1ZVxuXHQgKlxuXHQgKiBAcmV0dXJuIFRoZSBjcmVhdGVkIGlzc3VlXG5cdCAqXG5cdCAqIEBzZWUgaHR0cHM6Ly9kZXZlbG9wZXIuZ2l0aHViLmNvbS92My9pc3N1ZXMvI2NyZWF0ZS1hbi1pc3N1ZVxuXHQgKi9cblx0QGxvZ01ldGhvZFxuXHRAbm90aWNlRXJyb3Jcblx0YXN5bmMgcG9zdElzc3VlKHtcblx0XHRhY2Nlc3NUb2tlbixcblx0XHR0aXRsZSxcblx0XHRjb250ZW50LFxuXHR9OiB7XG5cdFx0YWNjZXNzVG9rZW46IFZzc3VlQVBJLkFjY2Vzc1Rva2VuXG5cdFx0dGl0bGU6IHN0cmluZ1xuXHRcdGNvbnRlbnQ6IHN0cmluZ1xuXHR9KTogUHJvbWlzZTxWc3N1ZUFQSS5Jc3N1ZT5cblx0e1xuXHRcdGNvbnN0IHsgZGF0YSB9ID0gYXdhaXQgQmx1ZWJpcmQucmVzb2x2ZSh0aGlzLiRodHRwLnBvc3QoYHJlcG9zLyR7dGhpcy5vd25lcn0vaXNzdWVzYCwgdGhpcy5faGFuZGxlUmVxdWVzdFBvc3Qoe1xuXHRcdFx0XHR0aXRsZSxcblx0XHRcdFx0Ym9keTogY29udGVudCxcblx0XHRcdFx0cmVwbzogdGhpcy5yZXBvLFxuXHRcdFx0XHRsYWJlbHM6IHRoaXMubGFiZWxzLmpvaW4oJywnKSxcblx0XHRcdH0sIHtcblx0XHRcdFx0dnNzdWVEYXRhOiB7XG5cdFx0XHRcdFx0YWNjZXNzVG9rZW4sXG5cdFx0XHRcdFx0dGl0bGUsXG5cdFx0XHRcdFx0Y29udGVudCxcblx0XHRcdFx0fSxcblx0XHRcdH0pLCB7XG5cdFx0XHRcdGhlYWRlcnM6IHsgJ0F1dGhvcml6YXRpb24nOiBgdG9rZW4gJHthY2Nlc3NUb2tlbn1gIH0sXG5cdFx0XHR9KSlcblx0XHRcdC50YXBDYXRjaCh0aGlzLl9oYW5kbGVBcGlFcnJvcilcblx0XHQ7XG5cblx0XHRyZXR1cm4gbm9ybWFsaXplSXNzdWUoZGF0YSlcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXQgY29tbWVudHMgb2YgdGhpcyBwYWdlIGFjY29yZGluZyB0byB0aGUgaXNzdWUgaWRcblx0ICpcblx0ICogQHBhcmFtIG9wdGlvbnMuYWNjZXNzVG9rZW4gLSBVc2VyIGFjY2VzcyB0b2tlblxuXHQgKiBAcGFyYW0gb3B0aW9ucy5pc3N1ZUlkIC0gVGhlIGlkIG9mIGlzc3VlXG5cdCAqIEBwYXJhbSBvcHRpb25zLnF1ZXJ5IC0gVGhlIHF1ZXJ5IHBhcmFtZXRlcnNcblx0ICpcblx0ICogQHJldHVybiBUaGUgY29tbWVudHNcblx0ICpcblx0ICogQHNlZSBodHRwczovL2RldmVsb3Blci5naXRodWIuY29tL3YzL2lzc3Vlcy9jb21tZW50cy8jbGlzdC1jb21tZW50cy1vbi1hbi1pc3N1ZVxuXHQgKiBAc2VlIGh0dHBzOi8vZGV2ZWxvcGVyLmdpdGh1Yi5jb20vdjMvI3BhZ2luYXRpb25cblx0ICpcblx0ICogQHJlYW1ya3Ncblx0ICogR2l0aHViIFYzIGRvZXMgbm90IHN1cHBvcnQgc29ydCBmb3IgaXNzdWUgY29tbWVudHMgbm93LlxuXHQgKiBHaXRodWIgVjMgaGF2ZSB0byByZXF1ZXN0IHRoZSBwYXJlbnQgaXNzdWUgdG8gZ2V0IHRoZSBjb3VudCBvZiBjb21tZW50cy5cblx0ICovXG5cdEBsb2dNZXRob2Rcblx0QG5vdGljZUVycm9yXG5cdGFzeW5jIGdldENvbW1lbnRzKHtcblx0XHRhY2Nlc3NUb2tlbixcblx0XHRpc3N1ZUlkLFxuXHRcdHF1ZXJ5OiB7XG5cdFx0XHRwYWdlID0gMSxcblx0XHRcdHBlclBhZ2UgPSAxMCxcblx0XHRcdHNvcnQgPSAnZGVzYycsXG5cdFx0fSA9IHt9LFxuXHR9OiB7XG5cdFx0YWNjZXNzVG9rZW46IFZzc3VlQVBJLkFjY2Vzc1Rva2VuXG5cdFx0aXNzdWVJZDogc3RyaW5nIHwgbnVtYmVyXG5cdFx0cXVlcnk/OiBQYXJ0aWFsPFZzc3VlQVBJLlF1ZXJ5PlxuXHR9KTogUHJvbWlzZTxWc3N1ZUFQSS5Db21tZW50cz5cblx0e1xuXHRcdGNvbnN0IGlzc3VlT3B0aW9uczogQXhpb3NSZXF1ZXN0Q29uZmlnID0ge1xuXHRcdFx0cGFyYW1zOiB7XG5cdFx0XHRcdC8vIHRvIGF2b2lkIGNhY2hpbmdcblx0XHRcdFx0dGltZXN0YW1wOiBEYXRlLm5vdygpLFxuXHRcdFx0fSxcblx0XHR9XG5cdFx0Y29uc3QgY29tbWVudHNPcHRpb25zOiBBeGlvc1JlcXVlc3RDb25maWcgPSB7XG5cdFx0XHRwYXJhbXM6IHtcblx0XHRcdFx0Ly8gcGFnaW5hdGlvblxuXHRcdFx0XHQncGFnZSc6IHBhZ2UsXG5cdFx0XHRcdCdwZXJfcGFnZSc6IHBlclBhZ2UsXG5cdFx0XHRcdC8qKlxuXHRcdFx0XHQgKiBnaXRodWIgdjMgYXBpIGRvZXMgbm90IHN1cHBvcnQgc29ydCBmb3IgaXNzdWUgY29tbWVudHNcblx0XHRcdFx0ICogaGF2ZSBzZW50IGZlZWRiYWNrIHRvIGdpdGh1YiBzdXBwb3J0XG5cdFx0XHRcdCAqL1xuXHRcdFx0XHQvLyAnc29ydCc6ICdjcmVhdGVkJyxcblx0XHRcdFx0Ly8gJ2RpcmVjdGlvbic6IHNvcnQsXG5cdFx0XHRcdC8vIHRvIGF2b2lkIGNhY2hpbmdcblx0XHRcdFx0J3RpbWVzdGFtcCc6IERhdGUubm93KCksXG5cdFx0XHR9LFxuXHRcdFx0aGVhZGVyczoge1xuXHRcdFx0XHQnQWNjZXB0JzogW1xuXHRcdFx0XHRcdCdhcHBsaWNhdGlvbi92bmQuZ2l0aHViLnYzLnJhdytqc29uJyxcblx0XHRcdFx0XHQnYXBwbGljYXRpb24vdm5kLmdpdGh1Yi52My5odG1sK2pzb24nLFxuXHRcdFx0XHRcdCdhcHBsaWNhdGlvbi92bmQuZ2l0aHViLnNxdWlycmVsLWdpcmwtcHJldmlldycsXG5cdFx0XHRcdF0sXG5cdFx0XHR9LFxuXHRcdH1cblx0XHRpZiAoYWNjZXNzVG9rZW4pXG5cdFx0e1xuXHRcdFx0aXNzdWVPcHRpb25zLmhlYWRlcnMgPSB7XG5cdFx0XHRcdCdBdXRob3JpemF0aW9uJzogYHRva2VuICR7YWNjZXNzVG9rZW59YCxcblx0XHRcdH1cblx0XHRcdGNvbW1lbnRzT3B0aW9ucy5oZWFkZXJzWydBdXRob3JpemF0aW9uJ10gPSBgdG9rZW4gJHthY2Nlc3NUb2tlbn1gXG5cdFx0fVxuXG5cdFx0Ly8gZ2l0aHViIHYzIGhhdmUgdG8gZ2V0IHRoZSB0b3RhbCBjb3VudCBvZiBjb21tZW50cyBieSByZXF1ZXN0aW5nIHRoZSBpc3N1ZVxuXHRcdGNvbnN0IFtpc3N1ZVJlcywgY29tbWVudHNSZXNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0dGhpcy4kaHR0cC5nZXQoYHJlcG9zLyR7dGhpcy5vd25lcn0vJHt0aGlzLnJlcG99L2lzc3Vlcy8ke2lzc3VlSWR9YCwgaXNzdWVPcHRpb25zKSxcblx0XHRcdHRoaXMuJGh0dHAuZ2V0KGByZXBvcy8ke3RoaXMub3duZXJ9LyR7dGhpcy5yZXBvfS9pc3N1ZXMvJHtpc3N1ZUlkfS9jb21tZW50c2AsIGNvbW1lbnRzT3B0aW9ucyksXG5cdFx0XSlcblxuXHRcdC8vIGl0J3MgYW5ub3lpbmcgdGhhdCBoYXZlIHRvIGdldCB0aGUgcGFnZSBhbmQgcGVyX3BhZ2UgZnJvbSB0aGUgYExpbmtgIGhlYWRlclxuXHRcdGNvbnN0IGxpbmtIZWFkZXIgPSBjb21tZW50c1Jlcy5oZWFkZXJzWydsaW5rJ10gfHwgbnVsbFxuXG5cdFx0LyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cblx0XHRjb25zdCB0aGlzUGFnZSA9IC9yZWw9XCJuZXh0XCIvLnRlc3QobGlua0hlYWRlcilcblx0XHRcdD8gTnVtYmVyKGxpbmtIZWFkZXIucmVwbGFjZSgvXi4qW15fXXBhZ2U9KFxcZCopLipyZWw9XCJuZXh0XCIuKiQvLCAnJDEnKSkgLSAxXG5cdFx0XHQ6IC9yZWw9XCJwcmV2XCIvLnRlc3QobGlua0hlYWRlcilcblx0XHRcdFx0PyBOdW1iZXIobGlua0hlYWRlci5yZXBsYWNlKC9eLipbXl9dcGFnZT0oXFxkKikuKnJlbD1cInByZXZcIi4qJC8sICckMScpKSArIDFcblx0XHRcdFx0OiAxXG5cblx0XHQvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuXHRcdGNvbnN0IHRoaXNQZXJQYWdlID0gbGlua0hlYWRlciA/IE51bWJlcihsaW5rSGVhZGVyLnJlcGxhY2UoL14uKnBlcl9wYWdlPShcXGQqKS4qJC8sICckMScpKSA6IHBlclBhZ2VcblxuXHRcdHJldHVybiB7XG5cdFx0XHRjb3VudDogTnVtYmVyKGlzc3VlUmVzLmRhdGEuY29tbWVudHMpLFxuXHRcdFx0cGFnZTogdGhpc1BhZ2UsXG5cdFx0XHRwZXJQYWdlOiB0aGlzUGVyUGFnZSxcblx0XHRcdGRhdGE6IGNvbW1lbnRzUmVzLmRhdGEubWFwKG5vcm1hbGl6ZUNvbW1lbnQpLFxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGUgYSBuZXcgY29tbWVudFxuXHQgKlxuXHQgKiBAcGFyYW0gb3B0aW9ucy5hY2Nlc3NUb2tlbiAtIFVzZXIgYWNjZXNzIHRva2VuXG5cdCAqIEBwYXJhbSBvcHRpb25zLmlzc3VlSWQgLSBUaGUgaWQgb2YgaXNzdWVcblx0ICogQHBhcmFtIG9wdGlvbnMuY29udGVudCAtIFRoZSBjb250ZW50IG9mIGNvbW1lbnRcblx0ICpcblx0ICogQHJldHVybiBUaGUgY3JlYXRlZCBjb21tZW50XG5cdCAqXG5cdCAqIEBzZWUgaHR0cHM6Ly9kZXZlbG9wZXIuZ2l0aHViLmNvbS92My9pc3N1ZXMvY29tbWVudHMvI2NyZWF0ZS1hLWNvbW1lbnRcblx0ICovXG5cdEBsb2dNZXRob2Rcblx0QG5vdGljZUVycm9yXG5cdGFzeW5jIHBvc3RDb21tZW50KHtcblx0XHRhY2Nlc3NUb2tlbixcblx0XHRpc3N1ZUlkLFxuXHRcdGNvbnRlbnQsXG5cdH06IHtcblx0XHRhY2Nlc3NUb2tlbjogVnNzdWVBUEkuQWNjZXNzVG9rZW5cblx0XHRpc3N1ZUlkOiBzdHJpbmcgfCBudW1iZXJcblx0XHRjb250ZW50OiBzdHJpbmdcblx0fSk6IFByb21pc2U8VnNzdWVBUEkuQ29tbWVudD5cblx0e1xuXHRcdGNvbnN0IHsgZGF0YSB9ID0gYXdhaXQgQmx1ZWJpcmQucmVzb2x2ZSh0aGlzLiRodHRwLnBvc3QoYHJlcG9zLyR7dGhpcy5vd25lcn0vJHt0aGlzLnJlcG99L2lzc3Vlcy8ke2lzc3VlSWR9L2NvbW1lbnRzYCwge1xuXHRcdFx0XHRib2R5OiBjb250ZW50LFxuXHRcdFx0fSwge1xuXHRcdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdFx0J0F1dGhvcml6YXRpb24nOiBgdG9rZW4gJHthY2Nlc3NUb2tlbn1gLFxuXHRcdFx0XHRcdCdBY2NlcHQnOiBbXG5cdFx0XHRcdFx0XHQnYXBwbGljYXRpb24vdm5kLmdpdGh1Yi52My5yYXcranNvbicsXG5cdFx0XHRcdFx0XHQnYXBwbGljYXRpb24vdm5kLmdpdGh1Yi52My5odG1sK2pzb24nLFxuXHRcdFx0XHRcdFx0J2FwcGxpY2F0aW9uL3ZuZC5naXRodWIuc3F1aXJyZWwtZ2lybC1wcmV2aWV3Jyxcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHR9LFxuXHRcdFx0fSkpXG5cdFx0XHQudGFwQ2F0Y2godGhpcy5faGFuZGxlQXBpRXJyb3IpXG5cdFx0O1xuXHRcdHJldHVybiBub3JtYWxpemVDb21tZW50KGRhdGEpXG5cdH1cblxuXHQvKipcblx0ICogRWRpdCBhIGNvbW1lbnRcblx0ICpcblx0ICogQHBhcmFtIG9wdGlvbnMuYWNjZXNzVG9rZW4gLSBVc2VyIGFjY2VzcyB0b2tlblxuXHQgKiBAcGFyYW0gb3B0aW9ucy5jb21tZW50SWQgLSBUaGUgaWQgb2YgY29tbWVudFxuXHQgKiBAcGFyYW0gb3B0aW9ucy5jb250ZW50IC0gVGhlIGNvbnRlbnQgb2YgY29tbWVudFxuXHQgKlxuXHQgKiBAcmV0dXJuIFRoZSBlZGl0ZWQgY29tbWVudFxuXHQgKlxuXHQgKiBAc2VlIGh0dHBzOi8vZGV2ZWxvcGVyLmdpdGh1Yi5jb20vdjMvaXNzdWVzL2NvbW1lbnRzLyNlZGl0LWEtY29tbWVudFxuXHQgKi9cblx0QGxvZ01ldGhvZFxuXHRAbm90aWNlRXJyb3Jcblx0YXN5bmMgcHV0Q29tbWVudCh7XG5cdFx0YWNjZXNzVG9rZW4sXG5cdFx0Y29tbWVudElkLFxuXHRcdGNvbnRlbnQsXG5cdH06IHtcblx0XHRhY2Nlc3NUb2tlbjogVnNzdWVBUEkuQWNjZXNzVG9rZW5cblx0XHRpc3N1ZUlkOiBzdHJpbmcgfCBudW1iZXJcblx0XHRjb21tZW50SWQ6IHN0cmluZyB8IG51bWJlclxuXHRcdGNvbnRlbnQ6IHN0cmluZ1xuXHR9KTogUHJvbWlzZTxWc3N1ZUFQSS5Db21tZW50PlxuXHR7XG5cdFx0Y29uc3QgeyBkYXRhIH0gPSBhd2FpdCB0aGlzLiRodHRwLnBhdGNoKGByZXBvcy8ke3RoaXMub3duZXJ9LyR7dGhpcy5yZXBvfS9pc3N1ZXMvY29tbWVudHMvJHtjb21tZW50SWR9YCwge1xuXHRcdFx0Ym9keTogY29udGVudCxcblx0XHR9LCB7XG5cdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdCdBdXRob3JpemF0aW9uJzogYHRva2VuICR7YWNjZXNzVG9rZW59YCxcblx0XHRcdFx0J0FjY2VwdCc6IFtcblx0XHRcdFx0XHQnYXBwbGljYXRpb24vdm5kLmdpdGh1Yi52My5yYXcranNvbicsXG5cdFx0XHRcdFx0J2FwcGxpY2F0aW9uL3ZuZC5naXRodWIudjMuaHRtbCtqc29uJyxcblx0XHRcdFx0XHQnYXBwbGljYXRpb24vdm5kLmdpdGh1Yi5zcXVpcnJlbC1naXJsLXByZXZpZXcnLFxuXHRcdFx0XHRdLFxuXHRcdFx0fSxcblx0XHR9KVxuXHRcdHJldHVybiBub3JtYWxpemVDb21tZW50KGRhdGEpXG5cdH1cblxuXHQvKipcblx0ICogRGVsZXRlIGEgY29tbWVudFxuXHQgKlxuXHQgKiBAcGFyYW0gb3B0aW9ucy5hY2Nlc3NUb2tlbiAtIFVzZXIgYWNjZXNzIHRva2VuXG5cdCAqIEBwYXJhbSBvcHRpb25zLmNvbW1lbnRJZCAtIFRoZSBpZCBvZiBjb21tZW50XG5cdCAqXG5cdCAqIEByZXR1cm4gYHRydWVgIGlmIHN1Y2NlZWQsIGBmYWxzZWAgaWYgZmFpbGVkXG5cdCAqXG5cdCAqIEBzZWUgaHR0cHM6Ly9kZXZlbG9wZXIuZ2l0aHViLmNvbS92My9pc3N1ZXMvY29tbWVudHMvI2RlbGV0ZS1hLWNvbW1lbnRcblx0ICovXG5cdEBsb2dNZXRob2Rcblx0QG5vdGljZUVycm9yXG5cdGFzeW5jIGRlbGV0ZUNvbW1lbnQoe1xuXHRcdGFjY2Vzc1Rva2VuLFxuXHRcdGNvbW1lbnRJZCxcblx0fToge1xuXHRcdGFjY2Vzc1Rva2VuOiBWc3N1ZUFQSS5BY2Nlc3NUb2tlblxuXHRcdGlzc3VlSWQ6IHN0cmluZyB8IG51bWJlclxuXHRcdGNvbW1lbnRJZDogc3RyaW5nIHwgbnVtYmVyXG5cdH0pOiBQcm9taXNlPGJvb2xlYW4+XG5cdHtcblx0XHRjb25zdCB7IHN0YXR1cyB9ID0gYXdhaXQgdGhpcy4kaHR0cC5kZWxldGUoYHJlcG9zLyR7dGhpcy5vd25lcn0vJHt0aGlzLnJlcG99L2lzc3Vlcy9jb21tZW50cy8ke2NvbW1lbnRJZH1gLCB7XG5cdFx0XHRoZWFkZXJzOiB7ICdBdXRob3JpemF0aW9uJzogYHRva2VuICR7YWNjZXNzVG9rZW59YCB9LFxuXHRcdH0pXG5cdFx0cmV0dXJuIHN0YXR1cyA9PT0gMjA0XG5cdH1cblxuXHQvKipcblx0ICogR2V0IHJlYWN0aW9ucyBvZiBhIGNvbW1lbnRcblx0ICpcblx0ICogQHBhcmFtIG9wdGlvbnMuYWNjZXNzVG9rZW4gLSBVc2VyIGFjY2VzcyB0b2tlblxuXHQgKiBAcGFyYW0gb3B0aW9ucy5jb21tZW50SWQgLSBUaGUgaWQgb2YgY29tbWVudFxuXHQgKlxuXHQgKiBAcmV0dXJuIFRoZSBjb21tZW50c1xuXHQgKlxuXHQgKiBAc2VlIGh0dHBzOi8vZGV2ZWxvcGVyLmdpdGh1Yi5jb20vdjMvaXNzdWVzL2NvbW1lbnRzLyNnZXQtYS1zaW5nbGUtY29tbWVudFxuXHQgKiBAc2VlIGh0dHBzOi8vZGV2ZWxvcGVyLmdpdGh1Yi5jb20vdjMvcmVhY3Rpb25zLyNsaXN0LXJlYWN0aW9ucy1mb3ItYW4taXNzdWUtY29tbWVudFxuXHQgKlxuXHQgKiBAcmVtYXJrc1xuXHQgKiBUaGUgYExpc3QgcmVhY3Rpb25zIGZvciBhbiBpc3N1ZSBjb21tZW50YCBBUEkgYWxzbyByZXR1cm5zIGF1dGhvciBvZiBlYWNoIHJlYWN0aW9uLlxuXHQgKiBBcyB3ZSBvbmx5IG5lZWQgdGhlIGNvdW50LCB1c2UgdGhlIGBHZXQgYSBzaW5nbGUgY29tbWVudGAgQVBJIGlzIG11Y2ggc2ltcGxlci5cblx0ICovXG5cdEBsb2dNZXRob2Rcblx0QG5vdGljZUVycm9yXG5cdGFzeW5jIGdldENvbW1lbnRSZWFjdGlvbnMoe1xuXHRcdGFjY2Vzc1Rva2VuLFxuXHRcdGNvbW1lbnRJZCxcblx0fToge1xuXHRcdGFjY2Vzc1Rva2VuOiBWc3N1ZUFQSS5BY2Nlc3NUb2tlblxuXHRcdGlzc3VlSWQ6IHN0cmluZyB8IG51bWJlclxuXHRcdGNvbW1lbnRJZDogc3RyaW5nIHwgbnVtYmVyXG5cdH0pOiBQcm9taXNlPFZzc3VlQVBJLlJlYWN0aW9ucz5cblx0e1xuXHRcdGNvbnN0IHsgZGF0YSB9ID0gYXdhaXQgdGhpcy4kaHR0cC5nZXQoYHJlcG9zLyR7dGhpcy5vd25lcn0vJHt0aGlzLnJlcG99L2lzc3Vlcy9jb21tZW50cy8ke2NvbW1lbnRJZH1gLCB7XG5cdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdCdBdXRob3JpemF0aW9uJzogYHRva2VuICR7YWNjZXNzVG9rZW59YCxcblx0XHRcdFx0J0FjY2VwdCc6ICdhcHBsaWNhdGlvbi92bmQuZ2l0aHViLnNxdWlycmVsLWdpcmwtcHJldmlldycsXG5cdFx0XHR9LFxuXHRcdH0pXG5cdFx0cmV0dXJuIG5vcm1hbGl6ZVJlYWN0aW9ucyhkYXRhLnJlYWN0aW9ucylcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGUgYSBuZXcgcmVhY3Rpb24gb2YgYSBjb21tZW50XG5cdCAqXG5cdCAqIEBwYXJhbSBvcHRpb25zLmFjY2Vzc1Rva2VuIC0gVXNlciBhY2Nlc3MgdG9rZW5cblx0ICogQHBhcmFtIG9wdGlvbnMuY29tbWVudElkIC0gVGhlIGlkIG9mIGNvbW1lbnRcblx0ICogQHBhcmFtIG9wdGlvbnMucmVhY3Rpb24gLSBUaGUgcmVhY3Rpb25cblx0ICpcblx0ICogQHJldHVybiBgdHJ1ZWAgaWYgc3VjY2VlZCwgYGZhbHNlYCBpZiBhbHJlYWR5IHRva2VuXG5cdCAqXG5cdCAqIEBzZWUgaHR0cHM6Ly9kZXZlbG9wZXIuZ2l0aHViLmNvbS92My9yZWFjdGlvbnMvI2NyZWF0ZS1yZWFjdGlvbi1mb3ItYW4taXNzdWUtY29tbWVudFxuXHQgKi9cblx0QGxvZ01ldGhvZFxuXHRAbm90aWNlRXJyb3Jcblx0YXN5bmMgcG9zdENvbW1lbnRSZWFjdGlvbih7XG5cdFx0YWNjZXNzVG9rZW4sXG5cdFx0Y29tbWVudElkLFxuXHRcdHJlYWN0aW9uLFxuXHR9OiB7XG5cdFx0YWNjZXNzVG9rZW46IFZzc3VlQVBJLkFjY2Vzc1Rva2VuXG5cdFx0aXNzdWVJZDogc3RyaW5nIHwgbnVtYmVyXG5cdFx0Y29tbWVudElkOiBzdHJpbmcgfCBudW1iZXJcblx0XHRyZWFjdGlvbjoga2V5b2YgVnNzdWVBUEkuUmVhY3Rpb25zXG5cdH0pOiBQcm9taXNlPGJvb2xlYW4+XG5cdHtcblx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuJGh0dHAucG9zdChgcmVwb3MvJHt0aGlzLm93bmVyfS8ke3RoaXMucmVwb30vaXNzdWVzL2NvbW1lbnRzLyR7Y29tbWVudElkfS9yZWFjdGlvbnNgLCB7XG5cdFx0XHRjb250ZW50OiBtYXBSZWFjdGlvbk5hbWUocmVhY3Rpb24pLFxuXHRcdH0sIHtcblx0XHRcdGhlYWRlcnM6IHtcblx0XHRcdFx0J0F1dGhvcml6YXRpb24nOiBgdG9rZW4gJHthY2Nlc3NUb2tlbn1gLFxuXHRcdFx0XHQnQWNjZXB0JzogJ2FwcGxpY2F0aW9uL3ZuZC5naXRodWIuc3F1aXJyZWwtZ2lybC1wcmV2aWV3Jyxcblx0XHRcdH0sXG5cdFx0fSlcblx0XHRyZXR1cm4gcmVzcG9uc2Uuc3RhdHVzID09PSAyMDFcblx0fVxuXG59XG4iXX0=