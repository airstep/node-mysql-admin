import axios from 'axios'


const Http = {

    post(url, data) {

        if(!data) {
            data = {}
        }

        return axios.post(url, data)
    },

    get(url) {
        return axios.get(url)
    },

}

export default Http