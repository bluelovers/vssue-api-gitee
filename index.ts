import 'reflect-metadata'
import { VssueAPI } from 'vssue'
import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios'
import { buildURL, concatURL, parseQuery } from '@vssue/utils'
import Bluebird from 'bluebird'
import {
	normalizeUser,
	normalizeIssue,
	normalizeComment,
	normalizeReactions,
	mapReactionName, EnumMyConst, logMethod, noticeError, IIssues,
} from './utils'

/**
 * @see https://gitee.com/api/v5/oauth_doc
 */
export default class VssueGiteeAPI implements VssueAPI.Instance
{
	baseURL: string
	owner: string
	repo: string
	labels: Array<string>
	clientId: string
	clientSecret: string
	state: string
	proxy: string | ((url: string) => string)
	$http: AxiosInstance

	private _pageInfo: {
		page: number
		startCursor: string | null
		endCursor: string | null
		sort: string | null
		perPage: number | null
	}

	readonly scope: string = 'user_info issues notes'

	constructor({
		baseURL = EnumMyConst.BASE_URL,
		owner,
		repo,
		labels,
		clientId,
		clientSecret,
		state,
		proxy,
	}: VssueAPI.Options)
	{
		if (typeof clientSecret === 'undefined')
		{
			throw new Error(`clientSecret is required for ${EnumMyConst.SITE_NAME}`)
		}
		this.baseURL = baseURL
		this.owner = owner
		this.repo = repo
		this.labels = labels

		this.clientId = clientId
		this.clientSecret = clientSecret
		this.state = state
		this.proxy = proxy

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

		this.$http.interceptors.response.use(response =>
		{
			if (response.data.error)
			{
				return Promise.reject(response.data.error_description)
			}
			if (response.data.errors)
			{
				return Promise.reject(response.data.errors[0].message)
			}
			return response
		})
	}

	/**
	 * The platform api info
	 */
	get platform(): VssueAPI.Platform
	{
		return {
			name: EnumMyConst.SITE_NAME,
			link: this.baseURL,
			version: 'v5',
			meta: {
				reactable: false,
				sortable: true,
			},
		}
	}

	/**
	 * Redirect to the authorization page of platform.
	 *
	 * @see https://developer.github.com/apps/building-oauth-apps/authorizing-oauth-apps/#1-request-a-users-github-identity
	 */
	redirectAuth(): void
	{
		window.location.href = buildURL(concatURL(this.baseURL, 'oauth/authorize'), {
			client_id: this.clientId,
			redirect_uri: window.location.href,
			scope: this.scope,
			state: this.state,
			response_type: 'code',
		})
	}

	protected _chooseAuth(query: {
		code: string | string[],
		state: string | string[],
	}): {
		code: string;
		state: string;
	}
	{
		if (Array.isArray(query.state) || Array.isArray(query.code))
		{
			for (let i in (query.state as string[]))
			{
				if (query.state[i] === this.state && query.code[i])
				{
					return {
						code: query.code[i] as string,
						state: query.state[i] as string,
					}
				}
			}

			return null;
		}

		return {
			code: query.code as string,
			state: query.state as string,
		}
	}

	protected _handleRequest(options: AxiosRequestConfig & {
		data?: {
			access_token?: string;
		}
	}, vssueData: {
		accessToken?: string;
		[k: string]: unknown;
	} = {})
	{
		const { accessToken } = vssueData;

		options.params = options.params || {};
		options.data = this._handleRequestPost(options.data, {
			options, vssueData,
		});

		options.headers = options.headers || {};

		if (accessToken)
		{
			options.headers['Authorization'] = `token ${accessToken}`;

			if (!options.method || options.method.toLowerCase() != 'post')
			{
				options.params.access_token = accessToken;
			}
		}

		return options;
	}

	protected _handleRequestPost(data: AxiosRequestConfig["data"] & {
		access_token?: string;
	}, {
		options = {} as AxiosRequestConfig,
		vssueData = {} as {
			accessToken?: string;
			[k: string]: unknown;
		},
	} = {})
	{
		const { accessToken } = vssueData;

		data = data || {};

		if (accessToken)
		{
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
	@logMethod
	async handleAuth(): Promise<VssueAPI.AccessToken>
	{
		const query = parseQuery(window.location.search)

		if (query.code)
		{
			const { code, state } = this._chooseAuth(query);

			if (state !== this.state)
			{
				return null
			}

			let u = new URL(window.location.href);
			u.searchParams.delete('code');
			u.searchParams.delete('state');
			window.history.replaceState(null, '', u.href);

			return this.getAccessToken({ code })
		}

		return null
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
	@logMethod
	async getAccessToken({
		code,
	}: {
		code: string
	}): Promise<string>
	{
		/**
		 * access_token api does not support cors
		 * @see https://github.com/isaacs/github/issues/330
		 */
		const originalURL = concatURL(this.baseURL, 'oauth/token')
		const proxyURL = typeof this.proxy === 'function'
			? this.proxy(originalURL)
			: this.proxy
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

		return access_token
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
	@logMethod
	@noticeError
	async getUser({
		accessToken,
	}: {
		accessToken: VssueAPI.AccessToken
	}): Promise<VssueAPI.User>
	{
		const { data } = await this.$http.request({

			url: 'user',

			params: {
				//access_token: accessToken,
			},

			data: {
				access_token: accessToken,
			},

			headers: { 'Authorization': `token ${accessToken}` },
		})
		return normalizeUser(data)
	}

	get _fullRepoPath()
	{
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
	@logMethod
	@noticeError
	async getIssue({
		accessToken,
		issueId,
		issueTitle,
	}: {
		accessToken: VssueAPI.AccessToken
		issueId?: string | number
		issueTitle?: string
	}): Promise<VssueAPI.Issue | null>
	{
		const options: AxiosRequestConfig = {}

		console.log(`getIssue`, {
			accessToken,
			issueId,
			issueTitle,
		});

		if (accessToken)
		{
			options.headers = {
				'Authorization': `token ${accessToken}`,
			}
		}

		this._handleRequest(options, {
			accessToken,
		});

		if (issueId)
		{
			try
			{
				// to avoid caching
				options.params.timestamp = Date.now();
				options.params.state = 'all';

				const { data } = await this.$http.get(`repos/${this.owner}/${this.repo}/issues/${issueId}`, options)

				let issue = normalizeIssue(data)

				console.log(`getIssue`, 1, data, issue);

				return issue
			}
			catch (e)
			{
				if (e.response && e.response.status === 404)
				{
					return null
				}
				else
				{
					throw e
				}
			}
		}
		else if (1)
		{
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
				.then(({ data }) =>
				{
					let issue = (data as IIssues[])
						.filter((issue: IIssues) =>
						{
							return issue.title === issueTitle
						})
						.sort((a, b) =>
						{
							return a.labels.filter(k => labels.includes(k)).length
								- b.labels.filter(k => labels.includes(k)).length
						})
						[0]
					;

					if (issue)
					{
						return normalizeIssue(issue)
					}

					return null
				})
				;
		}
		else
		{
			options.params = {
				...options.params,
				//labels: this.labels.join(','),
				sort: 'created',
				direction: 'asc',
				state: 'all',
				// to avoid caching
				timestamp: Date.now(),
			}
			const { data } = await this.$http.get(`repos/${this.owner}/${this.repo}/issues`, options);

			console.log(`getIssue`, 2.1, data, typeof data);
			console.log(this);

			const issue = data
				.map(normalizeIssue)
				.filter((issue: IIssues) =>
				{
					console.log([issue.title, issue.title === issueTitle, issue]);

					console.log(issue.labels);

					return issue.title === issueTitle
				})[0]
			;

			return issue || null
		}
	}

	protected _handleApiError(e: AxiosError)
	{
		if (e && e.response && e.response.data && e.response.data.html_url && e.response.data.action)
		{
			setTimeout(() =>
			{
				window.open(e.response.data.html_url, 'gitee')
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
	@logMethod
	@noticeError
	async postIssue({
		accessToken,
		title,
		content,
	}: {
		accessToken: VssueAPI.AccessToken
		title: string
		content: string
	}): Promise<VssueAPI.Issue>
	{
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
			.tapCatch(this._handleApiError)
		;

		return normalizeIssue(data)
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
	@logMethod
	@noticeError
	async getComments({
		accessToken,
		issueId,
		query: {
			page = 1,
			perPage = 10,
			sort = 'desc',
		} = {},
	}: {
		accessToken: VssueAPI.AccessToken
		issueId: string | number
		query?: Partial<VssueAPI.Query>
	}): Promise<VssueAPI.Comments>
	{
		const issueOptions: AxiosRequestConfig = {
			params: {
				// to avoid caching
				timestamp: Date.now(),
			},
		}
		const commentsOptions: AxiosRequestConfig = {
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
		}
		if (accessToken)
		{
			issueOptions.headers = {
				'Authorization': `token ${accessToken}`,
			}
			commentsOptions.headers['Authorization'] = `token ${accessToken}`
		}

		// github v3 have to get the total count of comments by requesting the issue
		const [issueRes, commentsRes] = await Promise.all([
			this.$http.get(`repos/${this.owner}/${this.repo}/issues/${issueId}`, issueOptions),
			this.$http.get(`repos/${this.owner}/${this.repo}/issues/${issueId}/comments`, commentsOptions),
		])

		// it's annoying that have to get the page and per_page from the `Link` header
		const linkHeader = commentsRes.headers['link'] || null

		/* istanbul ignore next */
		const thisPage = /rel="next"/.test(linkHeader)
			? Number(linkHeader.replace(/^.*[^_]page=(\d*).*rel="next".*$/, '$1')) - 1
			: /rel="prev"/.test(linkHeader)
				? Number(linkHeader.replace(/^.*[^_]page=(\d*).*rel="prev".*$/, '$1')) + 1
				: 1

		/* istanbul ignore next */
		const thisPerPage = linkHeader ? Number(linkHeader.replace(/^.*per_page=(\d*).*$/, '$1')) : perPage

		return {
			count: Number(issueRes.data.comments),
			page: thisPage,
			perPage: thisPerPage,
			data: commentsRes.data.map(normalizeComment),
		}
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
	@logMethod
	@noticeError
	async postComment({
		accessToken,
		issueId,
		content,
	}: {
		accessToken: VssueAPI.AccessToken
		issueId: string | number
		content: string
	}): Promise<VssueAPI.Comment>
	{
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
			.tapCatch(this._handleApiError)
		;
		return normalizeComment(data)
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
	@logMethod
	@noticeError
	async putComment({
		accessToken,
		commentId,
		content,
	}: {
		accessToken: VssueAPI.AccessToken
		issueId: string | number
		commentId: string | number
		content: string
	}): Promise<VssueAPI.Comment>
	{
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
		})
		return normalizeComment(data)
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
	@logMethod
	@noticeError
	async deleteComment({
		accessToken,
		commentId,
	}: {
		accessToken: VssueAPI.AccessToken
		issueId: string | number
		commentId: string | number
	}): Promise<boolean>
	{
		const { status } = await this.$http.delete(`repos/${this.owner}/${this.repo}/issues/comments/${commentId}`, {
			headers: { 'Authorization': `token ${accessToken}` },
		})
		return status === 204
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
	@logMethod
	@noticeError
	async getCommentReactions({
		accessToken,
		commentId,
	}: {
		accessToken: VssueAPI.AccessToken
		issueId: string | number
		commentId: string | number
	}): Promise<VssueAPI.Reactions>
	{
		const { data } = await this.$http.get(`repos/${this.owner}/${this.repo}/issues/comments/${commentId}`, {
			headers: {
				'Authorization': `token ${accessToken}`,
				'Accept': 'application/vnd.github.squirrel-girl-preview',
			},
		})
		return normalizeReactions(data.reactions)
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
	@logMethod
	@noticeError
	async postCommentReaction({
		accessToken,
		commentId,
		reaction,
	}: {
		accessToken: VssueAPI.AccessToken
		issueId: string | number
		commentId: string | number
		reaction: keyof VssueAPI.Reactions
	}): Promise<boolean>
	{
		const response = await this.$http.post(`repos/${this.owner}/${this.repo}/issues/comments/${commentId}/reactions`, {
			content: mapReactionName(reaction),
		}, {
			headers: {
				'Authorization': `token ${accessToken}`,
				'Accept': 'application/vnd.github.squirrel-girl-preview',
			},
		})
		return response.status === 201
	}

}
