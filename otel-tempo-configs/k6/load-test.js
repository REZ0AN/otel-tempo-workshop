import http from 'k6/http';
import { sleep } from 'k6';

export let options = {
  vus: 10,        // number of virtual users
  duration: '30s' // test duration
};

export default function () {
  http.get('http://node-app:5010/api/v1/io_tasks');
  sleep(1);
}
