import 'reflect-metadata';
import { VssueAPI } from 'vssue';
import { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
/**
 * @see https://gitee.com/api/v5/oauth_doc
 */
export default class VssueGiteeAPI implements VssueAPI.Instance {
    baseURL: string;
    owner: string;
    repo: string;
    labels: Array<string>;
    clientId: string;
    clientSecret: string;
    state: string;
    proxy: string | ((url: string) => string);
    $http: AxiosInstance;
    private _pageInfo;
    readonly scope: string;
    constructor({ baseURL, owner, repo, labels, clientId, clientSecret, state, proxy, }: VssueAPI.Options);
    /**
     * The platform api info
     */
    readonly platform: VssueAPI.Platform;
    /**
     * Redirect to the authorization page of platform.
     *
     * @see https://developer.github.com/apps/building-oauth-apps/authorizing-oauth-apps/#1-request-a-users-github-identity
     */
    redirectAuth(): void;
    protected _chooseAuth(query: {
        code: string | string[];
        state: string | string[];
    }): {
        code: string;
        state: string;
    };
    protected _handleRequest(options: AxiosRequestConfig & {
        data?: {
            access_token?: string;
        };
    }, vssueData?: {
        accessToken?: string;
        [k: string]: unknown;
    }): AxiosRequestConfig & {
        data?: {
            access_token?: string;
        };
    };
    protected _handleRequestPost(data: AxiosRequestConfig["data"] & {
        access_token?: string;
    }, { options, vssueData, }?: {
        options?: AxiosRequestConfig;
        vssueData?: {
            [k: string]: unknown;
            accessToken?: string;
        };
    }): any;
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
    handleAuth(): Promise<VssueAPI.AccessToken>;
    /**
     * Get user access token via `code`
     *
     * @param options.code - The code from the query
     *
     * @return User access token
     *
     * @see https://developer.github.com/apps/building-oauth-apps/authorizing-oauth-apps/#2-users-are-redirected-back-to-your-site-by-github
     */
    getAccessToken({ code, }: {
        code: string;
    }): Promise<string>;
    /**
     * Get the logined user with access token.
     *
     * @param options.accessToken - User access token
     *
     * @return The user
     *
     * @see https://developer.github.com/v3/users/#get-the-authenticated-user
     */
    getUser({ accessToken, }: {
        accessToken: VssueAPI.AccessToken;
    }): Promise<VssueAPI.User>;
    readonly _fullRepoPath: string;
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
    getIssue({ accessToken, issueId, issueTitle, }: {
        accessToken: VssueAPI.AccessToken;
        issueId?: string | number;
        issueTitle?: string;
    }): Promise<VssueAPI.Issue | null>;
    protected _handleApiError(e: AxiosError): void;
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
    postIssue({ accessToken, title, content, }: {
        accessToken: VssueAPI.AccessToken;
        title: string;
        content: string;
    }): Promise<VssueAPI.Issue>;
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
    getComments({ accessToken, issueId, query: { page, perPage, sort, }, }: {
        accessToken: VssueAPI.AccessToken;
        issueId: string | number;
        query?: Partial<VssueAPI.Query>;
    }): Promise<VssueAPI.Comments>;
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
    postComment({ accessToken, issueId, content, }: {
        accessToken: VssueAPI.AccessToken;
        issueId: string | number;
        content: string;
    }): Promise<VssueAPI.Comment>;
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
    putComment({ accessToken, commentId, content, }: {
        accessToken: VssueAPI.AccessToken;
        issueId: string | number;
        commentId: string | number;
        content: string;
    }): Promise<VssueAPI.Comment>;
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
    deleteComment({ accessToken, commentId, }: {
        accessToken: VssueAPI.AccessToken;
        issueId: string | number;
        commentId: string | number;
    }): Promise<boolean>;
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
    getCommentReactions({ accessToken, commentId, }: {
        accessToken: VssueAPI.AccessToken;
        issueId: string | number;
        commentId: string | number;
    }): Promise<VssueAPI.Reactions>;
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
    postCommentReaction({ accessToken, commentId, reaction, }: {
        accessToken: VssueAPI.AccessToken;
        issueId: string | number;
        commentId: string | number;
        reaction: keyof VssueAPI.Reactions;
    }): Promise<boolean>;
}
