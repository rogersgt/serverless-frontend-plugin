<template>
  <div id="get-data">
    <img alt="Vue logo" src="./assets/vue-icon.png">
    <h1>Get some API Data</h1>
    <button v-on:click="getHelloData()">Get Hello Data</button>
    <p>{{ message }}</p>
  </div>
</template>

<script>
import axios from 'axios';
const { VUE_APP_API_BASE_URL } = process.env;
export default {
  data() {
    return {
      message: '',
    };
  },
  methods: {
    async getHelloData() {
      const { data: respBody } = await axios.get(`${VUE_APP_API_BASE_URL}/hello`);
    const { message } = respBody;
    this.message = message;
   },
  },
}
</script>

<style scoped>
#get-data {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>