// composables/useContactInfo.ts

export function useContactInfo() {
    return {
        email: 'info@cloudless.gr',
        twitter: 'https://twitter.com/cloudlessgr',
        github: 'https://github.com/cloudlessgr',
        linkedin: 'https://linkedin.com/company/cloudlessgr',
        social: [
            {
                name: 'Twitter',
                url: 'https://twitter.com/cloudlessgr',
                icon: 'faTwitter',
                color: '#1da1f2',
                aria: 'Twitter',
            },
            {
                name: 'GitHub',
                url: 'https://github.com/cloudlessgr',
                icon: 'faGithub',
                color: '#333',
                aria: 'GitHub',
            },
            {
                name: 'LinkedIn',
                url: 'https://linkedin.com/company/cloudlessgr',
                icon: 'faLinkedin',
                color: '#0077b5',
                aria: 'LinkedIn',
            },
        ],
    }
}
